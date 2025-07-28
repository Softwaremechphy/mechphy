export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { type, data } = req.body;

  try {
    // Log the received data
    console.log("Received data:", { type, data });

    // If you want to implement WebSocket later:
    /*
    const ws = new WebSocket("ws://localhost:8003");
    ws.on("open", () => {
      ws.send(JSON.stringify({ type, data }));
      ws.close();
    });
    */

    return res.status(200).json({ 
      success: true,
      message: "Details updated successfully",
      data: { type, ...data }
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error",
      error: error.message 
    });
  }
}