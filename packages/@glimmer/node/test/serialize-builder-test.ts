import * as SimpleDOM from 'simple-dom';
import { TestEnvironment, TestDynamicScope, blockStack } from "@glimmer/test-helpers";
import { Template, NewElementBuilder } from '@glimmer/runtime';
import { Simple } from '@glimmer/interfaces';
import { precompile } from '@glimmer/compiler';
import { UpdatableReference } from '@glimmer/object-reference';
import { NodeDOMTreeConstruction, SerializeBuilder } from '..';

let voidMap = SimpleDOM.voidMap;

let serializer = new SimpleDOM.HTMLSerializer(voidMap);

// const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
// const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';
// const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

let env: TestEnvironment,
    root: Simple.Element,
    elementBuilder: NewElementBuilder,
    b: (id: number) => string;

function compile(template: string) {
  return env.compile(template);
}

function commonSetup() {
  b = blockStack();
  env = new TestEnvironment({ document: new SimpleDOM.Document() });
  elementBuilder = SerializeBuilder.forInitialRender();
  root = elementBuilder.dom.createElement('div');
  elementBuilder.initializeCursor(root, null);
}

function render(template: Template, self: any) {
  let result;
  env.begin();
  let templateIterator = template.renderLayout({
    env,
    elementBuilder,
    self: new UpdatableReference(self),
    dynamicScope: new TestDynamicScope()
  });

  do {
    result = templateIterator.next();
  } while (!result.done);

  result = result.value;
  env.commit();
  return result;
}

function module(name: string) {
  return QUnit.module(name, {
    beforeEach() { commonSetup(); }
  });
}

module("Server-side rendering in Node.js");

QUnit.test("HTML text content", function(assert) {
  let template = compile("content");
  render(template, {});

  assert.equal(serializer.serializeChildren(root), `${b(0)}content${b(0)}`);
});

QUnit.test("HTML tags", function(assert) {
  let template = compile("<h1>hello!</h1><div>content</div>");
  render(template, {});

  assert.equal(serializer.serializeChildren(root), `${b(0)}<h1>hello!</h1><div>content</div>${b(0)}`);
});

QUnit.test("HTML tags re-rendered", function(assert) {
  let template = compile("<h1>hello!</h1><div>content</div>");
  let result = render(template, {});

  env.begin();

  assert.throws(() => {
    result!.rerender();
  }, /\[ATTENTION\]: You are trying to update the DOM in the server\./);

  env.commit();
});

QUnit.test("HTML attributes", function(assert) {
  let template = compile("<div id='bar' class='foo'>content</div>");
  render(template, {});

  assert.equal(serializer.serializeChildren(root), `${b(0)}<div id="bar" class="foo">content</div>${b(0)}`);
});

QUnit.test("HTML tag with empty attribute", function(assert) {
  let template = compile("<div class=''>content</div>");
  render(template, {});

  assert.equal(serializer.serializeChildren(root), `${b(0)}<div class>content</div>${b(0)}`);
});

QUnit.test("HTML boolean attribute 'disabled'", function(assert) {
  let template = compile('<input disabled>');
  render(template, {});

  assert.equal(serializer.serializeChildren(root), `${b(0)}<input disabled>${b(0)}`, 'disabled without value set as property is true');
});

QUnit.test("Quoted attribute expression is removed when null", function(assert) {
  let template = compile('<input disabled="{{isDisabled}}">');
  render(template, { isDisabled: null });

  assert.equal(serializer.serializeChildren(root), `${b(0)}<input>${b(0)}`, 'string of "null" set as property');
});

QUnit.test("Unquoted attribute expression with null value is not coerced", function(assert) {
  let template = compile('<input disabled={{isDisabled}}>');
  render(template, { isDisabled: null });

  assert.equal(serializer.serializeChildren(root), `${b(0)}<input>${b(0)}`);
});

QUnit.test("Attribute expression can be followed by another attribute", function(assert) {
  let template = compile('<div foo="{{funstuff}}" name="Alice"></div>');
  render(template, {funstuff: "oh my"});

  assert.equal(serializer.serializeChildren(root), `${b(0)}<div foo="oh my" name="Alice"></div>${b(0)}`);
});

QUnit.test("HTML tag with data- attribute", function(assert) {
  let template = compile("<div data-some-data='foo'>content</div>");
  render(template, {});

  assert.ok(serializer.serializeChildren(root), `${b(0)}<div data-some-data="foo">content</div>${b(0)}`);
});

QUnit.test("The compiler can handle nesting", function(assert) {
  let html = '<div class="foo"><p><span id="bar" data-foo="bar">hi!</span></p></div>&nbsp;More content';
  let template = compile(html);
  render(template, {});

  // Note that the space after the closing div tag is a non-breaking space (Unicode 0xA0)
  assert.equal(serializer.serializeChildren(root), `${b(0)}<div class="foo"><p><span id="bar" data-foo="bar">hi!</span></p></div> More content${b(0)}`);
});

QUnit.test("The compiler can handle comments", function(assert) {
  let html = '<div><!-- Just passing through --></div>';
  let template = compile(html);
  render(template, {});
  assert.equal(serializer.serializeChildren(root), `${b(0)}${html}${b(0)}`);
});

QUnit.test("The compiler can handle HTML comments with mustaches in them", function(assert) {
  let template = compile('<div><!-- {{foo}} --></div>');
  render(template, { foo: 'bar' });

  assert.equal(serializer.serializeChildren(root), `${b(0)}<div><!-- {{foo}} --></div>${b(0)}`);
});

QUnit.test("The compiler can handle HTML comments with complex mustaches in them", function(assert) {
  let template = compile('<div><!-- {{foo bar baz}} --></div>');
  render(template, { foo: 'bar' });

  assert.equal(serializer.serializeChildren(root), `${b(0)}<div><!-- {{foo bar baz}} --></div>${b(0)}`);
});

QUnit.test("The compiler can handle HTML comments with multi-line mustaches in them", function(assert) {
  let html = '<div><!-- {{#each foo as |bar|}}\n{{bar}}\n\n{{/each}} --></div>';
  let template = compile(html);
  render(template, { foo: 'bar' });

  assert.equal(serializer.serializeChildren(root), `${b(0)}${html}${b(0)}`);
});

QUnit.test("The compiler can handle comments with no parent element", function(assert) {
  let html = '<!-- {{foo}} -->';
  let template = compile(html);
  render(template, { foo: 'bar' });

  assert.equal(serializer.serializeChildren(root), `${b(0)}${html}${b(0)}`);
});

QUnit.test("The compiler can handle simple handlebars", function(assert) {
  let template = compile('<div>{{title}}</div>');
  render(template, { title: 'hello' });

  assert.equal(serializer.serializeChildren(root), `${b(0)}<div>hello</div>${b(0)}`);
});

QUnit.test("The compiler can handle escaping HTML", function(assert) {
  let template = compile('<div>{{title}}</div>');
  render(template, { title: '<strong>hello</strong>' });

  assert.equal(serializer.serializeChildren(root), `${b(0)}<div>&lt;strong&gt;hello&lt;/strong&gt;</div>${b(0)}`);
});

QUnit.test("The compiler can handle unescaped HTML", function(assert) {
  let template = compile('<div>{{{title}}}</div>');
  render(template, { title: '<strong>hello</strong>' });

  assert.equal(serializer.serializeChildren(root), `${b(0)}<div>${b(1)}<!--%glimmer%--><strong>hello</strong><!--%glimmer%-->${b(1)}</div>${b(0)}`);
});

QUnit.test("Unescaped helpers render correctly", function(assert) {
  env.registerHelper('testing-unescaped', function(params) {
    return params[0];
  });

  let escapedTemplate = compile('{{{testing-unescaped "<span>hi</span>"}}}');

  render(escapedTemplate, {});

  assert.equal(serializer.serialize(root), `<div>${b(0)}${b(1)}<!--%glimmer%--><span>hi</span><!--%glimmer%-->${b(1)}${b(0)}</div>`);
});

QUnit.test('Null literals do not have representation in DOM', function(assert) {
  let template = compile('{{null}}');

  render(template, {});

  assert.equal(serializer.serialize(root), `<div>${b(0)}<!--%empty%-->${b(0)}</div>`);
});

QUnit.test("Attributes can be populated with helpers that generate a string", function(assert) {
  env.registerHelper('testing', function(params) {
    return params[0];
  });

  let escapedTemplate = compile('<a href="{{testing url}}">linky</a>');

  render(escapedTemplate, { url: 'linky.html' });

  assert.equal(serializer.serialize(root), `<div>${b(0)}<a href="linky.html">linky</a>${b(0)}</div>`);
});

QUnit.test("Elements inside a yielded block", function(assert) {
  let template = compile('{{#if true}}<div id="test">123</div>{{/if}}');
  render(template, {});
  assert.equal(serializer.serialize(root), `<div>${b(0)}${b(1)}<div id="test">123</div>${b(1)}${b(0)}</div>`);
});

QUnit.test("A simple block helper can return text", function(assert) {
  let template = compile('{{#if true}}test{{else}}not shown{{/if}}');
  render(template, {});
  assert.equal(serializer.serialize(root), `<div>${b(0)}${b(1)}test${b(1)}${b(0)}</div>`);
});

QUnit.test('can instantiate NodeDOMTreeConstruction without a document', function(assert) {
  // this emulates what happens in Ember when using `App.visit('/', { shouldRender: false });`

  let helper = new NodeDOMTreeConstruction(null as any);

  assert.ok(!!helper, 'helper was instantiated without errors');
});

QUnit.test("SVG: basic element", function(assert) {
  let template = `
    <svg xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" height="100" width="100" style="stroke:#ff0000; fill: #0000ff"></rect>
    </svg>
  `;
  render(compile(template), {});

  assert.equal(serializer.serializeChildren(root), `${b(0)}${template}${b(0)}`);
});

QUnit.test("SVG: element with xlink:href", function(assert) {
  let template = `
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <rect x=".01" y=".01" width="4.98" height="2.98" fill="none" stroke="blue" stroke-width=".03"></rect>
      <a xlink:href="http://www.w3.org">
        <ellipse cx="2.5" cy="1.5" rx="2" ry="1" fill="red"></ellipse>
      </a>
    </svg>
  `;
  render(compile(template), {});

  assert.equal(serializer.serializeChildren(root), `${b(0)}${template}${b(0)}`);
});

module('default template id');

QUnit.test('generates id in node', function (assert) {
  let template = precompile('hello');
  let obj = JSON.parse(template);
  assert.equal(obj.id, 'zgnsoV7o', 'short sha of template source');
  template = precompile('hello', { meta: {moduleName: 'template/hello'} });
  obj = JSON.parse(template);
  assert.equal(obj.id, 'Ybe5TwSG', 'short sha of template source and meta');
});
