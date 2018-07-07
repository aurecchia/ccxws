const BasicClient = require("../basic-client");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Update = require("../level2-update");
const moment = require("moment");

class BitFlyerClient extends BasicClient {
  constructor() {
    super("wss://ws.lightstream.bitflyer.com/json-rpc", "BitFlyer");
    this.hasTrades = true;
    this.hasLevel2Updates = true;
  }

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        method: "subscribe",
        params: {
          channel: `lightning_executions_${remote_id}`,
        },
      })
    );
  }

  _sendSubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        method: "subscribe",
        params: {
          channel: `lightning_board_${remote_id}`,
        },
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        method: "unsubscribe",
        params: {
          channel: `lightning_executions_${remote_id}`,
        },
      })
    );
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        method: "unsubscribe",
        params: {
          channel: `lightning_board_${remote_id}`,
        },
      })
    );
  }

  _onMessage(data) {
    let parsed = JSON.parse(data);
    if (!parsed.params || !parsed.params.channel || !parsed.params.message) return;
    let { channel, message } = parsed.params;

    // trades
    if (channel.startsWith("lightning_executions_")) {
      let remote_id = channel.substr("lightning_executions_".length);
      for (let datum of message) {
        let trade = this._createTrades(remote_id, datum);
        this.emit("trade", trade);
      }
    }

    // orderbook
    if (channel.startsWith("lightning_board_")) {
      let remote_id = channel.substr("lightning_board_".length);
      let update = this._createLevel2Update(remote_id, message);
      this.emit("l2update", update);
    }
  }

  _createTrades(remoteId, datum) {
    let { size, side, exec_date, price, id } = datum;
    let market = this._tradeSubs.get(remoteId);

    size = side === "BUY" ? parseFloat(size) : -parseFloat(size);
    let priceNum = parseFloat(price);
    let unix = moment(exec_date).unix();

    return new Trade({
      exchange: "bitFlyer",
      base: market.base,
      quote: market.quote,
      tradeId: id,
      unix,
      price: priceNum,
      amount: size,
    });
  }

  _createLevel2Update(remote_id, msg) {
    let market = this._level2UpdateSubs.get(remote_id);
    let asks = msg.asks.map(p => new Level2Point(p.price.toFixed(8), p.size.toFixed(8)));
    let bids = msg.bids.map(p => new Level2Point(p.price.toFixed(8), p.size.toFixed(8)));

    return new Level2Update({
      exchange: "bitFlyer",
      base: market.base,
      quote: market.quote,
      asks,
      bids,
    });
  }
}

module.exports = BitFlyerClient;
