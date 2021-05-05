import { help } from '../src/commands/help.js';
import { balance } from '../src/commands/balance.js';
import { executeCommand, getOption } from '../src/commands/index.js';
import {
  embedResponse,
  tokenNotFoundResponse,
  transactionFailedResponse,
  transactionResponse,
  previewTransactionResponse,
  invalidAmountResponse,
  sendHelpResponse,
  missingOptionsResponse,
} from '../src/responses/index.js';
import { connect } from '../src/db/index.js';
import { User, getOrCreateWallet } from '../src/user/index.js';
import { Token } from '../src/tokens/index.js';
import * as eth2 from '../src/eth2/index.js';
import { Amount } from '../src/eth2/amount.js';
import { Wallet } from '../src/eth2/wallet.js';
import { listTokens } from '../src/commands/listTokens.js';
import { unlock } from '../src/commands/unlock.js';
import { send } from '../src/commands/send.js';
import { getString } from '../src/strings/index.js';

describe('help', () => {
  it('should respond with help text', () => {
    const res = help({ type: 2 });
    expect(res).toEqual(embedResponse({
      title: 'Introduction to Kangaroo 🦘',
      "color": 15422875,
      fields: [
        {
          name: "What is It? ⁉️",
          value: "Kangaroo is a crypto tipping bot built with Layer 2 onboarding in mind. It supports Ethereum and a range of ERC-20 tokens."
        },
        {
          name: "Frictionless withdrawals 💸",
          value: "Typical Ethereum token transactions can have fees upwards of $20. Harness the power of Layer 2 and withdraw your funds for nearly 100 times less."
        },
        {
          name: "Grow your community 👥",
          value: "Engage your discord server with a plethora community oriented features. Better yet, give crypto funds that your community members can actually use."
        },
        {
          name: "The Basics 📘",
          value: "Tip other users, deposit and withdraw ETH and ERC-20 tokens to your Layer 2 wallet. "
        },
        {
          name: "Layer 2 Native 👏",
          value: "Kangaroo lives on Layer 2 Ethereum. No slow or expensive user experience."
        }
      ]
    }));
  });
});

describe('balance', () => {
  const PRIVATE_KEY = process.env.TEST_PRIVATE_KEY;

  beforeAll(async () => {
    if (!PRIVATE_KEY) {
      throw new Error(
        'You must provide an account in the TEST_PRIVATE_KEY environment variable'
      );
    }
    await connect();
    await eth2.init();
  });

  describe('with balance', () => {
    let balanceETH, balanceDAI;
    beforeAll(async () => {
      await (new Token({ ticker: 'ETH', name: 'Ethereum' })).save();
      await (new Token({ ticker: 'DAI', name: 'Dai'})).save();
      await (new Token({ ticker: 'USDT', name: 'USDT' })).save();
      const userId = '1234';
      await new User({ userId, privateKey: PRIVATE_KEY }).save();
      const wallet = await Wallet.create(PRIVATE_KEY);
      balanceETH = (await wallet.getBalance({ ticker: 'ETH' })).getStringValue();
      balanceDAI = (await wallet.getBalance({ ticker: 'DAI' })).getStringValue();
    });
    
    afterAll(async () => {
      await User.deleteMany({});
      await Token.deleteMany({});
    });

    it('should respond with a specific balance if ticker is provided', async () => {
      const interaction = {
        data: { options: [ { name: 'ticker', value: 'ETH' } ] },
        user: { id: '1234' }
      };
      const res = await balance(interaction);
      const description = res.data.embeds[0].description;
      expect(res).toEqual(embedResponse({
        title: 'ETH Balance',
        color: 15422875,
        description
      }));
      const [value, ticker, , price] = description.split(' ');
      expect(value).toEqual(balanceETH);
      expect(ticker).toEqual('ETH');
      expect(price[0]).toEqual('$');
      expect(parseFloat(price.slice(1))).toBeGreaterThan(0);
    });

    it('should respond with a specific balance if ticker is provided case-insensitive', async () => {
      const interaction = {
        data: { options: [ { name: 'ticker', value: 'dai' } ] },
        user: { id: '1234' }
      };
      const res = await balance(interaction);
      const description = res.data.embeds[0].description;
      expect(res).toEqual(embedResponse({
        title: 'DAI Balance',
        color: 15422875,
        description
      }));
      const [value, ticker, , price] = description.split(' ');
      expect(value).toEqual(balanceDAI);
      expect(ticker).toEqual('DAI');
      expect(price[0]).toEqual('$');
      expect(parseFloat(price.slice(1))).toBeGreaterThan(0);
    });

    it('should respond with all balances if no options are provided', async () => {
      const interaction = { data: {}, user: { id: '1234' } };
      const res = await balance(interaction);
      const description = res.data.embeds[0].description;
      expect(res).toEqual(embedResponse({
        title: 'All Balances',
        color: 15422875,
        description
      }));
      const [ETHscription, DAIscription] = description.split('\n');
      {
        const [value, ticker, , price] = ETHscription.split(' ');
        expect(value).toEqual(balanceETH);
        expect(ticker).toEqual('ETH');
        expect(price[0]).toEqual('$');
        expect(parseFloat(price.slice(1))).toBeGreaterThan(0);
      }
      {
        const [value, ticker, , price] = DAIscription.split(' ');
        expect(value).toEqual(balanceDAI);
        expect(ticker).toEqual('DAI');
        expect(price[0]).toEqual('$');
        expect(parseFloat(price.slice(1))).toBeGreaterThan(0);
      }
    });

    it('should respond with an error message if an invalid ticker is provided', async () => {
      const interaction = {
        data: { options: [ { name: 'ticker', value: 'DOGE' } ] },
        user: { id: '1234' }
      };
      const res = await balance(interaction);
      expect(res).toEqual(tokenNotFoundResponse());
    });
  });

  describe('with no balance', () => {
    beforeAll(async () => {
      await (new Token({ ticker: 'ETH', name: 'Ethereum' })).save();
      await (new Token({ ticker: 'DAI', name: 'Dai'})).save();
      await (new Token({ ticker: 'BAT', name: 'Basic Attention Token' })).save();
    });

    afterAll(async () => {
      await Token.deleteMany({});
      await User.deleteMany({});
    });
    it('should show a no balance message if no options are provided', async () => {
      const interaction = { data: {}, user: { id: '1234' } };
      const res = await balance(interaction);
      expect(res).toEqual(embedResponse({
        title: 'All Balances',
        color: 15422875,
        description: 'You don\'t have any tokens :('
      }));
    });

    it('should show a zero balance if a ticker is provided', async () => {
      const interaction = {
        data: {
          options: [
            {
              name: 'ticker',
              value: 'DAI'
            }
          ]
        },
        user: { id: '1234' }
      };
      const res = await balance(interaction);
      const description = res.data.embeds[0].description;
      expect(res).toEqual(embedResponse({
        title: 'DAI Balance',
        color: 15422875,
        description
      }));
      const [value, ticker, , price] = description.split(' ');
      expect(value).toEqual('0.0');
      expect(ticker).toEqual('DAI');
      expect(price).toEqual('$0.00');
    });
  });
});

describe('execute command', () => {
  it('should select function based on command', async () => {
    const interaction = {
      type: 2,
      data: {
        name: 'help'
      }
    };
    const res = await executeCommand(interaction);
    expect(res).toEqual(embedResponse({
      title: 'Introduction to Kangaroo 🦘',
      "color": 15422875,
      fields: [
        {
          name: "What is It? ⁉️",
          value: "Kangaroo is a crypto tipping bot built with Layer 2 onboarding in mind. It supports Ethereum and a range of ERC-20 tokens."
        },
        {
          name: "Frictionless withdrawals 💸",
          value: "Typical Ethereum token transactions can have fees upwards of $20. Harness the power of Layer 2 and withdraw your funds for nearly 100 times less."
        },
        {
          name: "Grow your community 👥",
          value: "Engage your discord server with a plethora community oriented features. Better yet, give crypto funds that your community members can actually use."
        },
        {
          name: "The Basics 📘",
          value: "Tip other users, deposit and withdraw ETH and ERC-20 tokens to your Layer 2 wallet. "
        },
        {
          name: "Layer 2 Native 👏",
          value: "Kangaroo lives on Layer 2 Ethereum. No slow or expensive user experience."
        }
      ]
    }));
  });
});

describe('getOption', () => {
  it('should return the value of an option', () => {
    const interaction = {
      data: {
        options: [
          { name: 'jkl', value: 'pio', },
          { name: 'abc', value: 'def', }
        ]
      }
    };
    const value = getOption(interaction, 'abc');
    expect(value).toEqual('def');
  });

  it('should return undefined if the option is not there', () => {
    const interaction = {
      data: {
        options: [
          { name: 'jkl', value: 'pio', },
          { name: 'abc', value: 'def', }
        ]
      }
    };
    const value = getOption(interaction, 'not here');
    expect(value).toBeUndefined();
  });

  it('should return undefined if there are no options', () => {
    const interaction = { data: {} };
    const value = getOption(interaction, 'abc');
    expect(value).toBeUndefined();
  });
});

describe('list all tokens', () => {

  beforeAll(async () => {
    await connect();
    await (new Token({ ticker: 'ETH', name: 'Ethereum' })).save();
    await (new Token({ ticker: 'DAI', name: 'Dai'})).save();
    await (new Token({ ticker: 'BAT', name: 'Basic Attention Token' })).save();
  });

  afterAll(async () => {
    await Token.deleteMany({});
  });

  it('should respond with all tokens', async () => {
    const res = await(listTokens)({ type: 2 });
    expect(res).toEqual(embedResponse({
      title: 'All Supported Tokens📖',
      "color": 15422875,
      description: 'ETH | Ethereum\nDAI | Dai\nBAT | Basic Attention Token'
    }));
  });
});

describe('unlock', () => {
  const PRIVATE_KEY = process.env.TEST_PRIVATE_KEY;

  beforeAll(async () => {
    if (!PRIVATE_KEY) {
      throw new Error(
        'You must provide an account in the TEST_PRIVATE_KEY environment variable'
      );
    }
    await connect();
    await eth2.init();
    await (new Token({ ticker: 'ETH', name: 'Ethereum' })).save();
    await (new Token({ ticker: 'DAI', name: 'Dai'})).save();
  });

  afterAll(async () => {
    await Token.deleteMany({});
    await User.deleteMany({});
  });

  it('should return information when no arguments', async () => {
    const res = await unlock({
      data: {},
      user: { id: '1234' }
    });
    expect(res).toEqual(embedResponse({
      title: 'Unlocking Your Wallet',
      color: 15422875,
      description: [
        getString('unlockGeneralInfo'),
        getString('unlockInstructions'),
      ].join('\n\n')
    }));
    await User.deleteMany({});
  });

  it('should return already unlocked message if already unlocked', async () => {
    await new User({ userId: '1234', privateKey: PRIVATE_KEY }).save();
    const res = await unlock({
      data: {},
      user: { id: '1234' }
    });
    expect(res).toEqual(embedResponse({
      title: 'Wallet already unlocked',
      color: 15422875,
      description: [
        getString('unlockGeneralInfo'),
        getString('alreadyUnlocked'),
      ].join('\n\n')
    }));
    await User.deleteMany({});
  });

  it('should transaction preview when only ticker is provided', async () => {
    const res = await unlock({
      data: { options: [ { name: 'ticker', value: 'DAI' } ] },
      user: { id: '1234' }
    });
    await new Promise(resolve => setTimeout(resolve, 100));
    const wallet = await getOrCreateWallet('1234');
    const fee = (await wallet.getUnlockFee({ ticker: 'DAI' }))
      .getClosestPackable();
    expect(res).toEqual(embedResponse({
      title: 'Unlock with DAI',
      color: 15422875,
      description: [
        'Unlock your wallet using DAI?',
        `${fee.toString()} - ${await fee.getPrice()}`,
        'Do `/unlock DAI confirm` to confirm the transaction.',
      ].join('\n\n')
    }));
    await User.deleteMany({});
  });

  it('should unlock a wallet when confirmed', async () => {
    // Transfer the required fees
    const rootWallet = await Wallet.create(PRIVATE_KEY);
    const wallet = await getOrCreateWallet('1234');
    const sendAmount = (await wallet.getUnlockFee({ ticker: 'DAI' }))
      .add(Amount.fromStringValue({ ticker: 'DAI' }, '0.01'));
    await rootWallet.transfer(
      { ticker: 'DAI' },
      wallet.getAddress(),
      sendAmount,
      await rootWallet.getTransferFee({ ticker: 'DAI' }, wallet.getAddress())
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    const res = await unlock({
      data: { options: [
        { name: 'ticker', value: 'DAI' },
        { name: 'confirm', value: 'confirm' }
      ] },
      user: { id: '1234' }
    });
    expect(await wallet.getUnlocked()).toBeTrue();
    expect(res).toEqual(embedResponse({
      title: 'Unlock with DAI',
      color: 15422875,
      description: [
        'Wallet unlocked.',
      ].join('\n\n')
    }));
    await User.deleteMany({});
  });

  it('should fail if there isn\'t enought balance', async () => {
    const res = await unlock({
      data: { options: [
        { name: 'ticker', value: 'ETH' },
        { name: 'confirm', value: 'confirm' }
      ] },
      user: { id: '1234' }
    });
    expect(res).toEqual(transactionFailedResponse());
    await User.deleteMany({});
  });
});

describe('send/tip', () => {
  const PRIVATE_KEY = process.env.TEST_PRIVATE_KEY;

  beforeAll(async () => {
    if (!PRIVATE_KEY) {
      throw new Error(
        'You must provide an account in the TEST_PRIVATE_KEY environment variable'
      );
    }
    await connect();
    await eth2.init();
    await (new Token({ ticker: 'ETH', name: 'Ethereum' })).save();
    await (new Token({ ticker: 'DAI', name: 'Dai'})).save();
  });

  afterAll(async () => {
    await Token.deleteMany({});
    await User.deleteMany({});
  });

  it('should return information when no options', async () => {
    const res = await send({
      data: { name: 'send' },
      user: { id: '1234' }
    });
    expect(res).toEqual(sendHelpResponse('send'));
    await User.deleteMany({});
  });

  it('should fail if not enough options are provided', async () => {
    const res = await send({
      data: { name: 'send', options: [
        { name: 'amount', value: '0.2' }
      ] },
      user: { id: '1234' }
    });
    expect(res).toEqual(missingOptionsResponse(['ticker', 'user']));
    await User.deleteMany({});
  });

  it('should fail if an invalid ticker is provided', async () => {
    const res = await send({
      data: { name: 'send', options: [
        { name: 'amount', value: '0.2' },
        { name: 'ticker', value: 'FAKE' },
        { name: 'user', value: '2345' },
      ] },
      user: { id: '1234' }
    });
    expect(res).toEqual(tokenNotFoundResponse());
    await User.deleteMany({});
  });

  it('should fail for an invalid amount', async () => {
    const res = await send({
      data: { name: 'send', options: [
        { name: 'amount', value: 'pizza' },
        { name: 'ticker', value: 'ETH' },
        { name: 'user', value: '2345' },
      ] },
      user: { id: '1234' }
    });
    expect(res).toEqual(invalidAmountResponse());
    await User.deleteMany({});
  });
  
  it('should fail for a negative amount', async () => {
    const res = await send({
      data: { name: 'send', options: [
        { name: 'amount', value: '-1' },
        { name: 'ticker', value: 'ETH' },
        { name: 'user', value: '2345' },
      ] },
      user: { id: '1234' }
    });
    expect(res).toEqual(invalidAmountResponse());
    await User.deleteMany({});
  });

  it('should preview a transaction', async () => {
    const res = await send({
      data: { name: 'send', options: [
        { name: 'amount', value: '0.2' },
        { name: 'ticker', value: 'ETH' },
        { name: 'user', value: '2345' },
      ] },
      user: { id: '1234' }
    });
    const wallet = await getOrCreateWallet('1234');
    const targetWallet = await getOrCreateWallet('2345');
    expect(res).toEqual(await previewTransactionResponse(
      'Transfer tokens',
      Amount.fromStringValue({ ticker: 'ETH' }, '0.2').getClosestPackable(),
      (await wallet.getTransferFee({ ticker: 'ETH' }, targetWallet.getAddress()))
        .getClosestPackable(),
      '/send 0.2 ETH @<insert user> confirm'
    ));
    await User.deleteMany({});
  });

  it('should send a transaction with confirm', async () => {
    await new User({ userId: '1234', privateKey: PRIVATE_KEY}).save();
    await new Promise(resolve => setTimeout(resolve, 100));
    const wallet = await getOrCreateWallet('1234');
    const targetWallet = await getOrCreateWallet('2345');
    const primaryAmount = Amount.fromStringValue({ ticker: 'DAI' }, '0.01')
      .getClosestPackable();
    const feeAmount = (await wallet.getTransferFee(
      { ticker: 'DAI' },
      targetWallet.getAddress()
    )).getClosestPackable();
    const res = await send({
      data: { name: 'send', options: [
        { name: 'amount', value: '0.01' },
        { name: 'ticker', value: 'DAI' },
        { name: 'user', value: '2345' },
        { name: 'confirm', value: 'confirm' },
      ] },
      user: { id: '1234' }
    });
    expect(res).toEqual(await transactionResponse(
      'Transfer tokens',
      primaryAmount,
      feeAmount,
    ));
    expect(await targetWallet.getBalance({ ticker: 'DAI' }))
      .toEqual(Amount.fromStringValue({ ticker: 'DAI' }, '0.01').getClosestPackable());
    await User.deleteMany({});
  });
});
