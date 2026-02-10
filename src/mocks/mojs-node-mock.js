// Minimal Node-friendly mock of @mojs/core used for headless tests/audit
const makeBurst = (opts = {}) => {
  return {
    opts,
    played: false,
    play() { this.played = true; return this; },
    stop() { this.played = false; return this; },
    tune() { return this; },
    replay() { this.play(); return this; }
  };
};

const mojsMock = {
  Burst: class {
    constructor(opts) { Object.assign(this, makeBurst(opts)); this.opts = opts; }
    play() { this.played = true; }
    stop() { this.played = false; }
    tune() { return this; }
    replay() { this.play(); return this; }
  },
  Tween: { update: () => {} },
  reducers: { update: () => {} },
  Html: class { constructor(opts){} play(){} }
};

export default mojsMock;
