import {createStream, QualifiedTag, SAXStream, Tag} from 'sax';
import {encodeXML} from 'entities/lib';
import X2JS from 'x2js';
import {Readable} from 'stream';

export class CommerceMlCollectRule {
  start: string[] = [];
  include?: string[][] = [];
}

export abstract class CommerceMlAbstractParser {
  /**
   * SAX Parser instance.
   */
  protected parser: SAXStream;

  /**
   *
   */
  protected position: string[] = [];

  /**
   *
   */
  protected openTag = '';

  /**
   *
   */
  protected collect = '';

  /**
   *
   */
  protected xml = '';

  /**
   *
   */
  protected collectCurrentNode = false;

  /**
   *
   */
  protected collectOpenTags: string[] = [];

  constructor() {
    this.parser = createStream(true, {
      trim: true,
      normalize: true
    });

    this.parser.on('opentag', (tag: Tag | QualifiedTag) => {
      this.onOpenTag(tag);
    });

    this.parser.on('closetag', (tagName: string) => {
      this.onCloseTag(tagName);
    });

    this.parser.on('text', (text: string) => {
      this.onText(text);
    });
  }

  /**
   * Starts parsing readable stream.
   * @param readStream
   */
  public async parse(readStream: Readable): Promise<void> {
    return new Promise((resolve, reject) => {
      this.parser.on('end', () => {
        resolve();
      });

      this.parser.on('error', error => {
        reject(error);
      });

      readStream.pipe(this.parser);
    });
  }

  /**
   * Returns SAX stream.
   */
  public getStream(): SAXStream {
    return this.parser;
  }

  public destroy(): void {
    this.parser.destroy();
  }

  /**
   * SAX 'opentag' event handler.
   * @param tag
   */
  protected onOpenTag(tag: Tag | QualifiedTag) {
    const nodeName = tag.name;
    const nodeAttrs = tag.attributes;

    this.position.push(nodeName);
    this.openTag = nodeName;
    this.collectCurrentNode = false;

    const collectRules = this.getCollectRules();
    for (const [key, props] of Object.entries(collectRules)) {
      if (this.isPositionEq(props.start)) {
        this.startCollect(key);
      }
    }

    if (this.collect && this.shallCollect()) {
      this.collectCurrentNode = true;
      this.xml += `<${nodeName}`;
      this.collectOpenTags.push(nodeName);

      for (const [key, value] of Object.entries(nodeAttrs)) {
        this.xml += ` ${key}="${value as string}"`;
      }
    }

    this.xml += '>';
    return this.xml;
  }

  /**
   *
   */
  protected shallCollect(): boolean {
    for (const rule of Object.values(this.getCollectRules())) {
      if (this.isPositionEq(rule.start)) {
        return true;
      }

      for (const position of rule.include ?? []) {
        if (this.isPositionEq(position, 'begin')) {
          return true;
        }
      }
    }

    return false;
  }

  protected startCollect(key: string) {
    if (this.collect) {
      this.emitCollected();
    }

    this.collect = key;
  }

  protected emitCollected(): void {
    if (this.collectOpenTags.length > 0) {
      for (let i = this.collectOpenTags.length - 1; i >= 0; i--) {
        this.xml += `</${this.collectOpenTags[i]}>`;
      }
    }

    const x2js = new X2JS();
    this.parser?.emit(this.collect, x2js.xml2js(this.xml));

    this.collectOpenTags = [];
    this.collect = '';
    this.xml = '';
  }

  protected onText(text: string) {
    if (this.openTag && this.collectCurrentNode) {
      this.xml += encodeXML(text);
    }
  }

  protected onCloseTag(nodeName: string) {
    if (this.collect) {
      if (this.shallCollect()) {
        this.xml += `</${nodeName}>`;
        this.reduceLastPosition(this.collectOpenTags);
      }

      if (this.isPositionEq(this.getCollectRules()[this.collect].start)) {
        this.emitCollected();
      }
    }

    this.reduceLastPosition(this.position);

    this.collectCurrentNode = false;
    this.openTag = '';
  }

  protected reduceLastPosition(position: string[]): void {
    position.splice(-1, 1);
  }

  protected isPositionEq(position: string[], mode: 'eq' | 'begin' = 'eq'): boolean {
    switch (mode) {
      case 'eq':
        if (position.length !== this.position.length) {
          return false;
        }

        break;

      case 'begin':
        if (position.length > this.position.length) {
          return false;
        }

        break;

      default:
    }

    for (const [i, item] of position.entries()) {
      if (item !== this.position[i]) {
        return false;
      }
    }

    return true;
  }

  protected abstract getCollectRules(): {[key: string]: CommerceMlCollectRule};
}
