describe('startup runtime observation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function loadRegister(runtime?: string) {
    jest.replaceProperty(process, 'env', { NEXT_RUNTIME: runtime, SECRET: 'must-not-log' });
    let register: () => void;
    jest.isolateModules(() => {
      register = require('../instrumentation').register;
    });
    return register;
  }

  it('logs only allowlisted versions once for the Node runtime', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const register = loadRegister('nodejs');

    register();
    register();

    expect(info.mock.calls).toEqual([
      [
        '[umami:runtime-startup]',
        {
          node: process.versions.node,
          brotli: process.versions.brotli,
          undici: process.versions.undici,
        },
      ],
    ]);
  });

  it.each(['edge', undefined])('does not log for runtime %s', runtime => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const register = loadRegister(runtime);

    register();
    register();

    expect(info).not.toHaveBeenCalled();
  });
});
