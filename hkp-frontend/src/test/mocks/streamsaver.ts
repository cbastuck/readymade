const streamSaver = {
  createWriteStream: () => ({
    getWriter: () => ({
      write: async () => {},
      close: async () => {},
      releaseLock: () => {},
    }),
  }),
};

export default streamSaver;
