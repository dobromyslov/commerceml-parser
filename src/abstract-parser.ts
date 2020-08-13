import {createStream, QualifiedTag, SAXStream, Tag} from 'sax';
import {encodeXML} from 'entities/lib';
import X2JS from 'x2js';
import {Readable} from 'stream';

export interface CommerceMlCollectRule {
  start: string[];
  include?: string[][];
}

export interface CommerceMlCollectRules {
  [key: string]: CommerceMlCollectRule;
}

export abstract class CommerceMlAbstractParser {
  /**
   * SAX Parser instance.
   */
  protected stream: SAXStream;

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
  protected currentRuleKey = '';

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
    this.stream = createStream(true, {
      trim: true,
      normalize: true
    });

    this.stream.on('opentag', (tag: Tag | QualifiedTag) => {
      this.onOpenTag(tag);
    });

    this.stream.on('closetag', (tagName: string) => {
      this.onCloseTag(tagName);
    });

    this.stream.on('text', (text: string) => {
      this.onText(text);
    });
  }

  /**
   * Starts parsing readable stream.
   * @param readStream
   */
  public async parse(readStream: Readable): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stream.on('end', () => {
        resolve();
      });

      this.stream.on('error', error => {
        reject(error);
      });

      readStream.pipe(this.stream);
    });
  }

  /**
   * Returns SAX stream.
   */
  public getStream(): SAXStream {
    return this.stream;
  }

  public end(): void {
    this.stream.end();
  }

  /**
   * SAX 'opentag' event handler.
   * @param tag
   */
  protected onOpenTag(tag: Tag | QualifiedTag) {
    this.position.push(tag.name);
    this.openTag = tag.name;
    this.collectCurrentNode = false;

    const collectRules = this.getCollectRules();
    for (const [key, props] of Object.entries(collectRules)) {
      if (this.isPositionEq(props.start)) {
        // Start collect
        if (this.currentRuleKey) {
          this.emitCollected();
        }

        this.currentRuleKey = key;
      }
    }

    if (this.currentRuleKey && this.shallCollect()) {
      this.collectCurrentNode = true;
      this.xml += `<${tag.name}`;
      this.collectOpenTags.push(tag.name);

      for (const [key, value] of Object.entries(tag.attributes)) {
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

  protected emitCollected(): void {
    if (this.collectOpenTags.length > 0) {
      for (let i = this.collectOpenTags.length - 1; i >= 0; i--) {
        this.xml += `</${this.collectOpenTags[i]}>`;
      }
    }

    const x2js = new X2JS();
    this.stream?.emit(this.currentRuleKey, x2js.xml2js(this.xml));

    this.collectOpenTags = [];
    this.currentRuleKey = '';
    this.xml = '';
  }

  protected onText(text: string) {
    if (this.openTag && this.collectCurrentNode) {
      this.xml += encodeXML(text);
    }
  }

  protected onCloseTag(tagName: string) {
    if (this.currentRuleKey) {
      if (this.shallCollect()) {
        this.xml += `</${tagName}>`;
        this.collectOpenTags.pop();
      }

      if (this.isPositionEq(this.getCollectRules()[this.currentRuleKey].start)) {
        this.emitCollected();
      }
    }

    this.position.pop();

    this.collectCurrentNode = false;
    this.openTag = '';
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

  protected abstract getCollectRules(): CommerceMlCollectRules;
}
