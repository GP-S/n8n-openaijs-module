const { OpenAIScript } = require('../dist/nodes/OpenAIScript.node.js');

(async () => {
  const node = new OpenAIScript();

  const context = {
    async getCredentials() {
      return { apiKey: 'test', baseUrl: '' };
    },
    getInputData() {
      return [];
    },
    getNodeParameter(name) {
      if (name === 'script') {
        return (
          "const os = require('os');" +
          "\nconsole.log('platform', os.platform());" +
          "\nconsole.log('openai chat defined', typeof openai.chat);" +
          "\nconsole.log('fetch defined', typeof fetch);" +
          "\nconsole.log('json stringify works', JSON.stringify({ test: 1 }));" +
          "\nreturn { ok: true };"
        );
      }
      if (name === 'mode') {
        return 'runOnceForAllItems';
      }
      return '';
    },
    getWorkflowDataProxy() {
      return {};
    },
    getNode() {
      return {};
    },
    helpers: {
      returnJsonArray(data) {
        return Array.isArray(data) ? data : [data];
      },
    },
    prepareOutputData(data) {
      return [data];
    },
  };

  const result = await node.execute.call(context);
  console.log('result', JSON.stringify(result));
})();
