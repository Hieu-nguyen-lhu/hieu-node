module.exports = {
  apps: [{
    name: "hieu-node",
    cwd: "/home/io-hieunode1-sixforce/htdocs/hieunode.sixforce.io.vn",
    script: "node_modules/next/dist/bin/next",
    args: "start -p 3000",
    instances: "max",
    exec_mode: "cluster",
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
};
