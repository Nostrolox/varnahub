const { openSync } = require("node:fs");
const { spawn } = require("node:child_process");

const cwd = "C:\\CodexApp";
const out = openSync(`${cwd}\\expo-start.log`, "w");
const err = openSync(`${cwd}\\expo-start.err.log`, "w");

const env = {
  APPDATA: "C:\\Users\\mitko\\AppData\\Roaming",
  COMSPEC: "C:\\Windows\\System32\\cmd.exe",
  EXPO_NO_TELEMETRY: "1",
  LOCALAPPDATA: "C:\\Users\\mitko\\AppData\\Local",
  Path: "C:\\Program Files\\nodejs;C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\WindowsPowerShell\\v1.0",
  SystemRoot: "C:\\Windows",
  TEMP: "C:\\Users\\mitko\\AppData\\Local\\Temp",
  TMP: "C:\\Users\\mitko\\AppData\\Local\\Temp",
  USERPROFILE: "C:\\Users\\mitko",
  WINDIR: "C:\\Windows"
};

const child = spawn(
  "C:\\Windows\\System32\\cmd.exe",
  ["/d", "/c", "C:\\CodexApp\\scripts\\start-expo.cmd"],
  {
    cwd,
    detached: true,
    env,
    stdio: ["ignore", out, err],
    windowsHide: true
  }
);

child.unref();
console.log(JSON.stringify({ pid: child.pid, log: `${cwd}\\expo-start.log` }));
