import "dotenv/config";

const regexes = {
  inviteUrl:
    /discord(?:(?:app)?\.com\/invite|\.gg(?:\/invite)?)\/(?<code>[\w-]{2,255})/i, // https://github.com/discordjs/discord.js/blob/e673b3c129f288f9f271e0b991d16dc2901cdc8a/packages/discord.js/src/structures/Invite.js#L21C3-L21C104
  inviteID: /^[\w-]{2,255}$/
  };

// set up in-memory key-value store for caching
import Keyv from "keyv";
const keyv = new Keyv();

// set up proxy
import { ProxyAgent } from "undici";
const dispatcher = new ProxyAgent(process.env.PROXY_URL);

export default async function fetchServerInfo(invite) {
  const inviteID = regexes.inviteUrl.exec(invite)?.groups?.code ?? invite;

  if (!inviteID || !regexes.inviteID.test(inviteID)) {
    return {
      error: "Invalid invite code",
    };
  }

  let serverInfo = await keyv.get(inviteID);

  // if the server info has expired, or has never been fetched, we fetch and cache it again
  if (!serverInfo) {
    serverInfo = await _fetchServer(inviteID);

    // if we get a fetch error we retry a few times, then we give up and cache it as broken for 24h.
    let i = 0;
    while (serverInfo.fetcherror) {
      serverInfo = await _fetchServer(inviteID);
      i += 1;

      if (i >= 5) {
        serverInfo = {
          error: `Persistent error: ${serverInfo.error}`,
        };
        break;
      }
    }

    // cache in memory for a day (servers don't really change that much)
    keyv.set(inviteID, serverInfo, 24 * 60 * 60 * 1000);
  }

  return serverInfo;
}

// function that actually "fetches" data in the "HTTP request" sense
async function _fetchServer(inviteID) {
  const reconstructedInviteURL = `https://discord.com/api/v10/invites/${inviteID}?with_counts=true&with_expiration=true`;

  try {
    const serverFetch = await fetch(reconstructedInviteURL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.3",
      },
      dispatcher,
    });

    if (!serverFetch.ok) {
      const server = await serverFetch.json();

      if (server.message === "Unknown Invite") {
        return {
          name: "Invalid invite",
          memberCount: "Check your invite or try again later",
        };
      } else {
        return {
          fetcherror: `${serverFetch.status}, ${serverFetch.statusText}`,
        };
      }
    }

    const server = await serverFetch.json();

    if (server.code === inviteID) {
      const info = {
        name: server.guild.name,
        memberCount: server.approximate_member_count,
      };

      if (info.memberCount == 1) {
        info.memberCount += " member";
      } else {
        info.memberCount += " members";
      }

      return info;
    } else {
      return {
        error: "invalid invite",
      };
    }
  } catch (error) {
    console.error("Fetch error:", error);
    return {
      fetcherror: `network error: ${error.message}`,
    };
  }
}
