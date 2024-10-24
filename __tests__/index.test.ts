import { hello } from "../src/index.ts";

describe("Index", () => {
  it("should return hello", () => {
    expect(hello()).toEqual("Hello, World");
  });
});
