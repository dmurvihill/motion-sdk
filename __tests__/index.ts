import { hello } from "../src";

describe('Index', () => {
  it('should return hello', () => {
    expect(hello()).toEqual('Hello, World');
  });
});
