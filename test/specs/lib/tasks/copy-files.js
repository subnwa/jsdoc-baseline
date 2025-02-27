const mock = require('mock-fs');
const config = require('../../../../lib/config');
const fs = require('fs-extra');
const CopyFiles = require('../../../../lib/tasks/copy-files');
const path = require('path');
const Ticket = require('../../../../lib/ticket');

const SOURCE_DIR = 'sourcefiles';
const OUTPUT_DIR = 'out';
const TYPE_ERROR = 'TypeError';

// Wrapper that provides explicit getters we can spy on.
// TODO: Move to test helper.
class TicketWrapper {
  constructor(ticket) {
    this.ticket = ticket;
  }

  get data() {
    return this.ticket.data;
  }

  get name() {
    return this.ticket.name;
  }

  get source() {
    return this.ticket.source;
  }

  get url() {
    return this.ticket.url;
  }

  get viewName() {
    return this.ticket.viewName;
  }
}

describe('lib/tasks/copy-files', () => {
  it('is a constructor', () => {
    function factory() {
      return new CopyFiles({});
    }

    expect(factory).not.toThrow();
  });

  it('accepts tickets', () => {
    const tickets = [
      new Ticket({
        source: path.join(SOURCE_DIR, 'foo.js'),
        url: 'foo.js',
      }),
    ];
    const task = new CopyFiles({
      name: 'acceptsTickets',
      tickets,
    });

    expect(task.tickets).toBe(tickets);
  });

  describe('run', () => {
    let conf;
    let context;
    let result;

    beforeEach(() => {
      conf = config.loadSync().get();
      context = {
        destination: OUTPUT_DIR,
        templateConfig: conf,
      };

      mock({
        [SOURCE_DIR]: {
          'foo.js': 'foo bar baz',
          'bar.css': 'bar baz qux',
        },
      });
    });

    afterEach(() => {
      mock.restore();
    });

    it('returns a promise on success', (cb) => {
      const task = new CopyFiles({ name: 'returnsPromise' });

      result = task.run(context);

      expect(result).toBeInstanceOf(Promise);

      // Handle the resolved promise.
      result.then(
        () => cb(),
        () => cb()
      );
    });

    it('returns a promise on failure', (cb) => {
      const task = new CopyFiles({
        name: 'returnsPromise',
      });

      result = task.run();

      expect(result).toBeInstanceOf(Promise);

      // Handle the rejected promise.
      result.then(
        () => cb(),
        () => cb()
      );
    });

    describe('tickets', () => {
      it('works if no tickets are specified', async () => {
        let error;
        const task = new CopyFiles({ name: 'noTickets' });

        try {
          await task.run(context);
        } catch (e) {
          error = e;
        }

        expect(error).toBeUndefined();
      });

      it('fails if the tickets are bogus', async () => {
        let error;
        const task = new CopyFiles({
          name: 'badTickets',
          tickets: true,
        });

        try {
          await task.run(context);
        } catch (e) {
          error = e;
        }

        expect(error).toBeErrorOfType(TYPE_ERROR);
      });

      it('processes one ticket', async () => {
        const tickets = [
          new Ticket({
            source: path.join(SOURCE_DIR, 'foo.js'),
            url: '',
          }),
        ];
        const wrappers = tickets.map((ticket) => new TicketWrapper(ticket));
        const task = new CopyFiles({
          name: 'oneTicket',
          tickets: wrappers,
        });
        const spy = spyOnProperty(wrappers[0], 'url').and.callFake(() => 'foo.js');

        await task.run(context);

        expect(spy).toHaveBeenCalled();
      });

      it('processes multiple tickets', async () => {
        const tickets = [
          new Ticket({
            source: path.join(SOURCE_DIR, 'foo.js'),
            url: '',
          }),
          new Ticket({
            source: path.join(SOURCE_DIR, 'bar.css'),
            url: '',
          }),
        ];
        const wrappers = tickets.map((ticket) => new TicketWrapper(ticket));
        const task = new CopyFiles({
          name: 'twoTickets',
          tickets: wrappers,
        });
        const spies = [
          spyOnProperty(wrappers[0], 'url').and.callFake(() => 'foo.js'),
          spyOnProperty(wrappers[1], 'url').and.callFake(() => 'bar.css'),
        ];

        await task.run(context);

        expect(spies[0]).toHaveBeenCalled();
        expect(spies[1]).toHaveBeenCalled();
      });
    });

    describe('output', () => {
      function stat(ctx, url) {
        return fs.statSync(path.join(ctx.destination, url));
      }

      it('creates the output directory as needed', async () => {
        const url = path.join('some', 'dir', 'foo.js');
        const ticket = new Ticket({
          source: path.join(SOURCE_DIR, 'foo.js'),
          url,
        });
        const task = new CopyFiles({
          name: 'oneTicket',
          tickets: [ticket],
        });

        await task.run(context);

        expect(() => stat(context, url)).not.toThrow();
      });

      it('copies the source to the destination', async () => {
        let file;
        const url = 'foo.js';
        const ticket = new Ticket({
          source: path.join(SOURCE_DIR, url),
          url,
        });
        const task = new CopyFiles({
          name: 'copyFile',
          tickets: [ticket],
        });

        await task.run(context);
        file = fs.readFileSync(path.join(OUTPUT_DIR, url), 'utf8');

        expect(file).toBe('foo bar baz');
      });

      it('saves files for multiple tickets in the right places', async () => {
        const urls = [path.join('some', 'dir', 'foo.js'), path.join('some', 'dir', 'bar.css')];
        const tickets = [
          new Ticket({
            source: path.join(SOURCE_DIR, 'foo.js'),
            url: urls[0],
          }),
          new Ticket({
            source: path.join(SOURCE_DIR, 'bar.css'),
            url: urls[1],
          }),
        ];
        const task = new CopyFiles({
          name: 'twoTickets',
          tickets,
        });

        await task.run(context);

        expect(() => stat(context, urls[0])).not.toThrow();
        expect(() => stat(context, urls[1])).not.toThrow();
      });

      it('works when tickets are passed to the constructor', async () => {
        let file;
        const url = 'foo.js';
        const ticket = new Ticket({
          source: path.join(SOURCE_DIR, url),
          url,
        });
        const task = new CopyFiles({
          name: 'copyFile',
          tickets: [ticket],
        });

        await task.run(context);
        file = fs.readFileSync(path.join(OUTPUT_DIR, url), 'utf8');

        expect(file).toBe('foo bar baz');
      });

      it('works when tickets are added after calling the constructor', async () => {
        let file;
        const url = 'foo.js';
        const ticket = new Ticket({
          source: path.join(SOURCE_DIR, url),
          url,
        });
        const task = new CopyFiles({
          name: 'copyFile',
        });

        task.tickets = [ticket];
        await task.run(context);
        file = fs.readFileSync(path.join(OUTPUT_DIR, url), 'utf8');

        expect(file).toBe('foo bar baz');
      });
    });
  });
});
