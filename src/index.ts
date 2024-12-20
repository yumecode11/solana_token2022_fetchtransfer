import express from "express";
import cors from "cors";
import http from "http";
import bodyParser from "body-parser";
import { Server } from "socket.io";
import dotenv from "dotenv";
import MainRouter from "./router";

dotenv.config();

const app = express();
const port = process.env.PORT || 1016;

const whitelist = [
    "http://localhost:3000"
];
const corsOptions = {
    origin: whitelist,
    credentials: false,
    sameSite: "none",
};

const server = http.createServer(app);
app.use(cors(corsOptions));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


let counter = 0;

const io = new Server(server, {
    cors: {
        origin: whitelist,
        credentials: false
    },
    // transports: ["websocket"],
    pingInterval: 10000,
    pingTimeout: 2000,
});

app.use("/api", MainRouter);

app.get("/", async (req: any, res: any) => {
    res.send("Backend Server is Running now!");
});

io.on("connection", (socket) => {
    // console.log(" --> ADD SOCKET", counter);
    counter++;
    io.emit("connectionUpdated", counter);
    socket.on("disconnect", () => {
        // console.log(" --> REMOVE SOCKET", counter);
        counter--;
        io.emit("connectionUpdated", counter);
    });
});

server.listen(port, async () => {
    console.log(`server is listening on ${port}`);

    return;
});
