const { createServer, request } = require("node:http");
const { once } = require("node:events");

async function serveGame() {
  const upstream = new URL(process.env.LCW_SAFARI_UPSTREAM);
  const scripts = [];
  const server = createServer((incoming, outgoing) => {
    if (incoming.url === "/__safari_init.js") {
      outgoing.writeHead(200, {"Content-Type": "text/javascript", "Cache-Control": "no-store"});
      outgoing.end(`
        window.lcwTestErrors = [];
        for (const level of ["warn", "error"]) {
          const original = console[level].bind(console);
          console[level] = (...args) => {
            window.lcwTestErrors.push({type: level, text: args.map(String).join(" ")});
            original(...args);
          };
        }
        addEventListener("error", event => {
          if (event.message) window.lcwTestErrors.push({type: "pageerror", text: event.message});
        });
        addEventListener("unhandledrejection", event => {
          window.lcwTestErrors.push({type: "pageerror", text: String(event.reason)});
        });
        ${scripts.map(fn => `(${fn.toString()})();`).join("\n")}
      `);
      return;
    }
    const path = new URL(incoming.url, "http://127.0.0.1");
    const proxy = request({
      hostname: "127.0.0.1",
      port: upstream.port,
      path: path.pathname + path.search,
      method: incoming.method,
      headers: {...incoming.headers, host: upstream.host, "accept-encoding": "identity"}
    }, upstreamResponse => {
      if (incoming.method !== "GET" || !upstreamResponse.headers["content-type"]?.startsWith("text/html")) {
        outgoing.writeHead(upstreamResponse.statusCode, upstreamResponse.headers);
        upstreamResponse.pipe(outgoing);
        return;
      }
      const chunks = [];
      upstreamResponse.on("data", chunk => chunks.push(chunk));
      upstreamResponse.on("end", () => {
        const headers = {...upstreamResponse.headers, "cache-control": "no-store"};
        delete headers["content-length"];
        delete headers.etag;
        outgoing.writeHead(upstreamResponse.statusCode, headers);
        const html = Buffer.concat(chunks).toString("utf8");
        outgoing.end(html.replace("<head>", '<head><script src="/__safari_init.js"></script>'));
      });
    });
    proxy.on("error", error => outgoing.destroy(error));
    incoming.pipe(proxy);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    scripts,
    origin: `http://127.0.0.1:${server.address().port}`,
    async close() {
      const closed = once(server, "close");
      server.close();
      server.closeAllConnections();
      await closed;
    }
  };
}

module.exports = {serveGame};
