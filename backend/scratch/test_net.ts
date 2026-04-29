import net from "net";

const host = "ep-lucky-glitter-a1wffw0n.ap-southeast-1.aws.neon.tech";
const port = 5432;

const client = new net.Socket();

console.log(`Attempting to connect to ${host}:${port}...`);

client.connect(port, host, () => {
  console.log("SUCCESS: Port 5432 is reachable!");
  client.destroy();
});

client.on("error", (err) => {
  console.error("FAILURE: Cannot reach port 5432.", err.message);
  client.destroy();
});

setTimeout(() => {
  console.log("TIMEOUT: Connection attempt timed out after 10 seconds.");
  client.destroy();
  process.exit(0);
}, 10000);
