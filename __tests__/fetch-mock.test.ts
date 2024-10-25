import fetchMock from "fetch-mock";

describe("fetch-mock", () => {
  const exampleDotComText =
    "This domain is for use in illustrative examples in documents.";
  const testUrl = "https://example.com/";

  beforeAll(() => {
    fetchMock.mockGlobal();
  });

  afterAll(() => {
    fetchMock.unmockGlobal();
  });

  afterEach(() => {
    fetchMock.clearHistory();
    fetchMock.removeRoutes();
  });

  it("should work when enabled", async () => {
    const mockText = "Hello, Mock!";
    fetchMock.get(testUrl, { status: 200, body: mockText });
    const body = await fetch(testUrl).then((r) => r.text());
    expect(body).toEqual(mockText);
    expect(fetchMock.callHistory.called(testUrl)).toBe(true);
  });

  it("should avoid real fetch when enabled, even if no mocks set", async () => {
    await expect(fetch(testUrl)).rejects.toBeInstanceOf(Error);
  });

  it("should allow real fetch when not enabled", async () => {
    fetchMock.unmockGlobal();
    try {
      const body = await fetch(testUrl).then((r) => r.text());
      expect(body).toContain(exampleDotComText);
      expect(fetchMock.callHistory.called(testUrl)).toBe(false);
    } finally {
      fetchMock.mockGlobal();
    }
  });
});
