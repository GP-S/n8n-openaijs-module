const { OpenAIScript } = require('../dist/nodes/OpenAIScript.node.js');

(async () => {
  const node = new OpenAIScript();

  const baseContext = {
    async getCredentials() {
      return { apiKey: 'test', baseUrl: '' };
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

  // Run once for all items
  let context = {
    ...baseContext,
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
  };

  let result = await node.execute.call(context);
  console.log('result1', JSON.stringify(result));

  // Run once for each item and expose full input array
  const items = [{ json: { index: 0 } }, { json: { index: 1 } }];
  context = {
    ...baseContext,
    getInputData() {
      return items;
    },
    getNodeParameter(name) {
      if (name === 'script') {
        return "return { len: input.length, idx: item.json.index };";
      }
      if (name === 'mode') {
        return 'runOnceForEachItem';
      }
      return '';
    },
  };

  result = await node.execute.call(context);
  console.log('result2', JSON.stringify(result));
})();
