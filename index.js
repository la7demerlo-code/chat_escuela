export default {
  async fetch(request, env) {
    if (request.headers.get("Upgrade") === "websocket") {
      let id = env.ClaseSession.idFromName("EES7_MERLO_ROOM");
      let roomObject = env.ClaseSession.get(id);
      return roomObject.fetch(request);
    }
    return new Response("Servidor Activo EES N7", { status: 200 });
  }
};

export class ClaseSession {
  constructor(state, env) {
    this.state = state;
    this.sockets = new Set();
    this.mesasEstado = {};
  }
  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.sockets.add(server);

    server.addEventListener("message", msg => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === "CONNECT_ALUMNO") {
          server.mesaId = data.mesa;
          this.mesasEstado[data.mesa] = "conectado";
          this.broadcast({ type: "UPDATE_GRID", estados: this.mesasEstado });
        } 
        else if (data.type === "PEDIR_PALABRA") {
          this.mesasEstado[data.mesa] = "parpadeo";
          this.broadcast({ type: "UPDATE_GRID", estados: this.mesasEstado });
        }
        else if (data.type === "PROF_CONTROL") {
          if (data.estado === "apagado") { delete this.mesasEstado[data.mesa]; } 
          else { this.mesasEstado[data.mesa] = data.estado; }
          this.broadcast({ type: "UPDATE_GRID", estados: this.mesasEstado });
        }
        else if (data.type === "SEND_LINK" || data.type === "SEND_TXT" || data.type === "CLOSE_CLASS") {
          if (data.type === "CLOSE_CLASS") this.mesasEstado = {};
          this.broadcast(data);
        }
      } catch (e) {}
    });

    server.addEventListener("close", () => {
      this.sockets.delete(server);
      if (server.mesaId && this.mesasEstado[server.mesaId] === "conectado") {
        delete this.mesasEstado[server.mesaId];
        this.broadcast({ type: "UPDATE_GRID", estados: this.mesasEstado });
      }
    });
    return new Response(null, { status: 101, webSocket: client });
  }
  broadcast(data) {
    const payload = JSON.stringify(data);
    for (let socket of this.sockets) {
      try { socket.send(payload); } catch (e) { this.sockets.delete(socket); }
    }
  }
}
