import WebSocket from "ws";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const ws = new WebSocket("ws://localhost:8003");

    ws.on("open", () => {
      ws.send(JSON.stringify(req.body));
      res.status(200).send("Data sent successfully");
    });

    ws.on("error", (error) => {
      console.error("WebSocket Error:", error);
      res.status(500).send("WebSocket Error");
    });
  } else {
    res.status(405).send("Method Not Allowed");
  }
}
