"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const os_1 = require("os");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const config_setup_1 = __importDefault(require("./src/tools/config-setup"));
require("./src/types/global");
require("./src/tools/console");
(0, config_setup_1.default)();
let running = false;
function run(file) {
    if (running)
        return;
    running = true;
    const args = [path_1.default.join(__dirname, file), ...process.argv.slice(2)];
    const p = (0, child_process_1.spawn)(process.argv[0], args, {
        stdio: ["inherit", "inherit", "inherit", "ipc"]
    });
    p.on("message", (msg) => {
        switch (msg) {
            case "reset":
                {
                    (0, os_1.platform)() === "win32" ? p.kill("SIGINT") : p.kill();
                    running = false;
                    run.apply(this, arguments);
                }
                break;
            case "uptime":
                {
                    p.send(process.uptime());
                }
                break;
        }
    });
    p.on("exit", (code) => {
        running = false;
        console.error("Exited with code:", code);
        if (code === 0)
            return;
        (0, fs_1.watchFile)(args[0], () => {
            if (!file.endsWith(".js"))
                return;
            (0, fs_1.unwatchFile)(args[0]);
            run(file);
        });
    });
}
run(__filename.endsWith(".ts") ? "src/miracle.ts" : "src/miracle.js");
