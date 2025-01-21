import "dotenv/config";

import express from "express";
const app = express();
const port = process.env.PORT || 9398;

const token = process.env.DC_TOKEN;

import { Client, Events, GatewayIntentBits } from "discord.js";

import fetchUserStatus from "./utils/fetchUserStatus.js";
import fetchServerInfo from "./utils/fetchServerInfo.js";
import generateShield from "./utils/generateShield.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in to Discord as ${readyClient.user.tag}`);

  app.get("/", (_req, res) => {
    res.redirect("https://github.com/gitlimes/discord-md-badge#readme");
  });

  app.get("/api/shield/:userID", async (req, res) => {
    const { userID } = req.params;
    const { bot, compact, theme, style, logoColor } = req.query;

    const userInfo = await fetchUserStatus(readyClient, userID, bot);

    if (userInfo.error) {
      return res.status(400).send(userInfo.error);
    }

    const shield = await generateShield({
      label: userInfo.username,
      message: userInfo.status,
      compact,
      theme,
      style,
      logoColor,
    });

    res.setHeader("Content-Type", "image/svg+xml");
    res.status(200).send(shield);
  });

  app.get("/api/server/:invite*", async (req, res) => {
    const invite = req.params.invite + req.params?.["0"];

    const { compact, theme, style, logoColor } = req.query;

    const serverInfo = await fetchServerInfo(invite);

    if (serverInfo.error) {
      return res.status(400).send(serverInfo.error);
    }

    const shield = await generateShield({
      label: serverInfo.name,
      message: serverInfo.memberCount,
      compact,
      theme,
      style,
      logoColor,
    });

    res.setHeader("Content-Type", "image/svg+xml");
    res.status(200).send(shield);
  });

  app.listen(port, () => {
    console.log(
      `discord-md-badge v2.2.0 listening at http://localhost:${port}`
    );
  });
});

// Log in to Discord with your client's token
client.login(token);
