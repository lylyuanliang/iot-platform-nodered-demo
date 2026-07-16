module.exports = {
  flowFile: "flows.json",
  contextStorage: {
    default: { module: "memory" },
    file: { module: "localfilesystem" }
  }
};
