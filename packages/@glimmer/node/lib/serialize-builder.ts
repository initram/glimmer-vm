import { NewElementBuilder, ElementBuilder, Bounds, ConcreteBounds } from "@glimmer/runtime";

import { Simple, Option } from "@glimmer/interfaces";
import NodeDOMTreeConstruction from "./node-dom-helper";
import * as SimpleDOM from 'simple-dom';

export class StringBuilder extends NewElementBuilder {
  public document: Simple.Document;
  static forInitialRender(cursor?: { element: Simple.Element, nextSibling: Option<Simple.Node> }) {
    let document = new SimpleDOM.Document();
    return new this(document, cursor);
  }

  constructor(doc: Simple.Document, cursor?: { element: Simple.Element, nextSibling: Option<Simple.Node> }) {
    super(doc, cursor);
    this.document = doc;
    this.dom = new NodeDOMTreeConstruction(doc);
    this.updateOperations = null; // Make sure nothing can update in SSR
  }
}

export class SerializeBuilder extends NewElementBuilder implements ElementBuilder {
  private serializeBlockDepth = 0;
  public document: Simple.Document;

  static forInitialRender(cursor?: { element: Simple.Element, nextSibling: Option<Simple.Node> }) {
    let document = new SimpleDOM.Document();
    return new this(document, cursor);
  }

  constructor(doc: Simple.Document, cursor?: { element: Simple.Element, nextSibling: Option<Simple.Node> }) {
    super(doc, cursor);
    this.document = doc;
    this.dom = new NodeDOMTreeConstruction(doc);
    this.updateOperations = null; // Make sure nothing can update in SSR
  }

  __openBlock(): void {
    let depth = this.serializeBlockDepth++;
    this.__appendComment(`%+block:${depth}%`);

    super.__openBlock();
  }

  __closeBlock(): void {
    super.__closeBlock();
    this.__appendComment(`%-block:${--this.serializeBlockDepth}%`);
  }

  __appendHTML(html: string): Bounds {
    let first = this.__appendComment('%glimmer%');
    super.__appendHTML(html);
    let last = this.__appendComment('%glimmer%');
    return new ConcreteBounds(this.element, first, last);
  }

  __appendText(string: string): Simple.Text {
    let current = currentNode(this);

    if (string === '') {
      return this.__appendComment('%empty%') as any as Simple.Text;
    } else if (current && current.nodeType === 3) {
      this.__appendComment('%sep%');
    }

    return super.__appendText(string);
  }
}

export function currentNode(cursor: { element: Simple.Element, nextSibling: Option<Simple.Node> }): Option<Simple.Node> {
  let { element, nextSibling } = cursor;

  if (nextSibling === null) {
    return element.lastChild;
  } else {
    return nextSibling.previousSibling;
  }
}
