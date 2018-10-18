import { loadModel, readInput } from './utils';

import * as tf from '@tensorflow/tfjs';
require('@tensorflow/tfjs-node');

const Hits = 'hits-aug';
const Kicks = 'kicks-aug';
const Negative = 'no-hits-aug';
const Epochs = 50;
const BatchSize = 0.1;
const InputShape = 1024;

const train = async () => {
  const mobileNet = await loadModel();
  const model = tf.sequential();
  model.add(tf.layers.inputLayer({ inputShape: [InputShape] }));
  model.add(tf.layers.dense({ units: 1024, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 2, activation: 'softmax' }));
  await model.compile({
    optimizer: tf.train.adam(1e-6),
    loss: tf.losses.sigmoidCrossEntropy,
    metrics: ['accuracy']
  });

  const hits = require('fs')
    .readdirSync(Hits)
    .filter(f => f.endsWith('.jpg'))
    .map(f => `${Hits}/${f}`);

  const kicks = require('fs')
    .readdirSync(Kicks)
    .filter(f => f.endsWith('.jpg'))
    .map(f => `${Kicks}/${f}`);

  const negatives = require('fs')
    .readdirSync(Negative)
    .filter(f => f.endsWith('.jpg'))
    .map(f => `${Negative}/${f}`);

  console.log('Building the training set');

  const ys = tf.tensor2d(
    new Array(hits.length)
      .fill([1, 0])
      .concat(new Array(kicks.length).fill([0, 1]))
      .concat(new Array(negatives.length).fill([0, 0])),
    [hits.length + kicks.length + negatives.length, 2]
  );

  console.log('Getting the punches');
  let xs: tf.Tensor2D = hits.reduce((p: tf.Tensor2D, path: string) => {
    const a = mobileNet(readInput(path));
    if (p) {
      return p.concat(a);
    }
    return a;
  }, null);

  console.log('Getting the kicks');
  xs = xs.concat(
    kicks.reduce((p: tf.Tensor2D, path: string) => {
      const a = mobileNet(readInput(path));
      if (p) {
        return p.concat(a);
      }
      return a;
    }, null)
  );

  console.log('Getting the negative samples');
  xs = xs.concat(
    negatives.reduce((p: tf.Tensor2D, path: string) => {
      const a = mobileNet(readInput(path));
      if (p) {
        return p.concat(a);
      }
      return a;
    }, null)
  );

  console.log('Fitting the model');
  await model.fit(xs, ys, {
    epochs: Epochs,
    batchSize: parseInt(((hits.length + kicks.length + negatives.length) * BatchSize).toFixed(0)),
    callbacks: {
      onBatchEnd: async (_, logs) => {
        console.log('Cost: %s, accuracy: %s', logs.loss.toFixed(5), logs.acc.toFixed(5));
        await tf.nextFrame();
      }
    }
  });

  console.log('Saving the model');
  await model.save('file://punch_kick_simplified');
};

train();