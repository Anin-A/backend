const Hapi = require('@hapi/hapi');
const { loadModel, predict } = require('./inference');

(async () => {
  // load and get machine learning model
  const model = await loadModel();
  console.log('Model loaded!');

  // initializing HTTP server
  const server = Hapi.server({
    host: process.env.NODE_ENV !== 'production' ? 'localhost' : '0.0.0.0',
    port: process.env.PORT || 3000
  });

  server.route({
    method: 'POST',
    path: '/predict',
    handler: async (request, h) => {
      try {
        const { image } = request.payload;
        const buffer = Buffer.from(image._data);

        const predictions = await predict(model, buffer);
        const isCancer = predictions[0] > 0.5 ? 'Cancer' : 'Non-cancer';
        const suggestion = isCancer === 'Cancer' ? 'Segera periksa ke dokter!' : 'Penyakit kanker tidak terdeteksi.';

        const data = {
          result: isCancer,
          suggestion: suggestion,
          createdAt: new Date().toISOString()
        };

        await firestore.collection('predictions').add(data);

        return h.response({
          status: 'success',
          message: 'Model is predicted successfully',
          data: data
        }).code(200);
      } catch (error) {
        return h.response({
          status: 'fail',
          message: 'Terjadi kesalahan dalam melakukan prediksi'
        }).code(400);
      }
    },
    options: {
      payload: {
        allow: 'multipart/form-data',
        maxBytes: 1000000,
        output: 'stream',
        parse: true
      }
    }
  });

  server.ext('onPreResponse', (request, h) => {
    const response = request.response;
    if (response.isBoom && response.output.statusCode === 413) {
      return h.response({
        status: 'fail',
        message: 'Payload content length greater than maximum allowed: 1000000'
      }).code(413);
    }
    return h.continue;
  });

  // running server
  await server.start();
  console.log(`Server running on ${server.info.uri}`);
})();

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});
