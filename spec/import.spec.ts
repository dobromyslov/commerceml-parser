import {CommerceMlImportParser} from '../src';
import {createReadStream} from 'fs';

describe('async import', () => {
  it('should be sequential', async () => {
    const readable = createReadStream('./data/import0_1_with_nested_groups.xml');
    const parser = new CommerceMlImportParser();

    parser.onCommercialInformation(commercialInformation => {
      console.log('Commercial Information');
      /*
      return new Promise<void>(async (resolve, reject) => {
        await new Promise<void>((resolve1, reject1) => {
          console.log('Commercial Information');
          resolve1();
        });
        resolve();
      });*/
    });

    parser.onClassifier(classifier => {
      return new Promise<void>(async (resolve) => {
        await new Promise<void>((resolve1) => {
          console.log('Classifier');
          resolve1();
        });
        resolve();
      });
    });

    parser.onClassifierGroup(classifierGroup => {
      return new Promise<void>(async (resolve) => {
        await new Promise<void>((resolve1) => {
          console.log('Classifier group');
          resolve1();
        });
        resolve();
      });
    });

    parser.onClassifierProperty(classifierProperty => {
      return new Promise<void>(async (resolve) => {
        await new Promise<void>((resolve1) => {
          console.log('Classifier property');
          resolve1();
        });
        resolve();
      });
    });

    parser.onCatalog(async catalog => {
      console.log('Start');
      await new Promise<void>(async (resolve) => {
        await new Promise<void>((resolve1) => {
          for (let i = 0; i < 1000000000; i++) {
          }
          console.log('First Level Promise End');
          resolve1();
        });
        console.log('Second Level Promise End');
        resolve();
      });
    });

    parser.onProduct(product => {
      return new Promise<void>(async (resolve) => {
        await new Promise<void>((resolve1) => {
          console.log('Product', product.id);
          resolve1();
        });
        resolve();
      });
    });

    parser.onEnd(() => {
      console.log('End');
    });

    await parser.parse(readable);
    readable.destroy();
    console.log('Done');
  });
});
