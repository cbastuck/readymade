import { processConfig } from "./Html";

test("basic test - scalar param and scalar config", () => {
  const config = [
    {
      html: "<div>[[title]]</div>",
    },
  ];
  const params = {
    link: "link1",
    title: "title1",
  };
  const processed = processConfig(config, params);
  expect(processed).toEqual("<div>title1</div>");
});

test("basic test - scalar param and one config element", () => {
  const config = [
    [
      {
        html: "<div>[[title]]</div>",
      },
    ],
  ];
  const params = {
    link: "link1",
    title: "title1",
  };
  const processed = processConfig(config, params);
  expect(processed).toEqual("<div>title1</div>");
});

test("basic test - scalar param and two config elements", () => {
  const config = [
    [
      {
        html: "<div>cfg1: [[title]]</div>",
      },
      {
        html: "<div>cfg2: [[title]]</div>",
      },
    ],
  ];
  const params = {
    link: "link1",
    title: "title1",
  };
  const processed = processConfig(config, params);
  expect(processed).toEqual("<div>cfg1: title1</div><div>cfg2: title1</div>");
});

test("basic test - scalar param and one config element with one child", () => {
  const config = [
    [
      {
        html: "<div>parent: [[title]] children: [[children]]</div>",
        children: [
          {
            html: "<div>child: [[title]]</div>",
          },
        ],
      },
    ],
  ];
  const params = {
    link: "link1",
    title: "title1",
  };
  const processed = processConfig(config, params);
  expect(processed).toEqual(
    "<div>parent: title1 children: <div>child: title1</div></div>"
  );
});

test("basic test - two param elements and one config element with one child", () => {
  const config = {
    html: "<div>parent: [[title]] children: [[children]]</div>",
    children: [
      {
        html: "<div>child: [[title]]</div>",
      },
    ],
  };
  const params = [
    {
      link: "link1",
      title: "title1",
    },
    {
      link: "link2",
      title: "title2",
    },
  ];
  const processed = processConfig(config, params);
  expect(processed).toEqual(
    "<div>parent: title1 children: <div>child: title1</div></div><div>parent: title2 children: <div>child: title2</div></div>"
  );
});

test("basic test - non-nested array param", () => {
  const config = [
    [
      {
        html: "<div>[[title]]</div>",
      },
    ],
  ];
  const params = [
    {
      link: "link1",
      title: "title1",
    },
    {
      link: "link2",
      title: "title2",
    },
  ];
  const processed = processConfig(config, params);
  expect(processed).toEqual("<div>title1</div><div>title2</div>");
});
