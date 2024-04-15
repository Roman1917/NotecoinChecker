const axios = require("axios");
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();
const TonWeb = require("tonweb");
const app = express();

const port = 3001;
let bounceable = "";

const processedNfts = new Set();

async function fetchEvents() {
  try {
    const response = await axios.get(
      "https://tonapi.io/v2/accounts/0:0816e9c02d110e790f7db3231b3bab12cccfc56b546c3c3e530684b4a9578a43/events?limit=3"
    );
    const nfts = response.data.events.map(
      (event) => event.actions[0].NftItemTransfer.nft
    );

    // Фильтруем NFT, которые уже были обработаны
    const newNfts = nfts.filter((nft) => !processedNfts.has(nft));

    const promises = newNfts.map((nft, index) =>
      singleEvent(nft, index * 3000)
    );

    await Promise.all(promises);

    setTimeout(fetchEvents, 3000);
  } catch (error) {
    console.error("Ошибка в fetchEvents:", error.message);
    setTimeout(fetchEvents, 3000);
  }
}

function singleEvent(nft, delay, attempt = 0) {
  return new Promise((resolve) => {
    setTimeout(async () => {
      try {
        if (!processedNfts.has(nft)) {
          const response = await axios.get(`https://tonapi.io/v2/nfts/${nft}`);

          if (response.data.metadata.name === "10M Notcoin Voucher") {
            let value = response.data.sale?.price.value;

            if (!isNaN(value) && value !== 0) {
              console.log(`Value for NFT ${nft}: Price: ${value / 1000000000}`);
              convertAddress(nft);
              sendToTelegram(
                `https://getgems.io/nft/${bounceable}: Price: ${
                  value / 1000000000
                } TON`
              );
            } else if (attempt < 10 && value !== 0) {
              console.log(`Retrying for NFT ${nft}, attempt ${attempt + 1}`);
              return resolve(singleEvent(nft, 3000, attempt + 1));
            } else {
              console.error(`Max attempts reached for NFT ${nft}, giving up.`);
              sendToTelegram(
                `https://getgems.io/nft/${bounceable}: Price: ${
                  value / 1000000000
                } TON`
              );
            }
          } else {
            console.log("- Пусто не NotCoin");
          }

          processedNfts.add(nft); // Добавляем NFT в набор обработанных
        }
      } catch (error) {
        console.error(`Error for NFT ${nft}:`, error.message);
        if (attempt < 10) {
          // Повторяем попытку при возникновении ошибки, если не превышено максимальное количество попыток
          console.log(`Retrying for NFT ${nft}, attempt ${attempt + 1}`);
          return resolve(singleEvent(nft, 3000, attempt + 1));
        }
      }
      resolve();
    }, delay);
  });
}

fetchEvents();
//------------------------------------------------------------------------
const fetch1 = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const BOT_TOKEN = "***************************"; // Replace with your actual bot token
const CHAT_ID = "**********"; // Replace with your actual chat ID

const sendToTelegram = async (text) => {
  const urlString = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch1(urlString, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: text,
      }),
    });

    const data = await response.json();
    console.log("Message sent successfully:");
  } catch (error) {
    console.error("Error sending message:", error);
  }
};
//--------------------------------------------------------------------------------

const convertAddress = async (value) => {
  const ton = new TonWeb();

  const showAddress = (address) => {
    const addressObj = new TonWeb.utils.Address(address);
    bounceable = addressObj.toString(true, true, true);
    console.log("🚀 ~ showAddress ~ bounceable:", bounceable);
  };

  if (!value.length) {
    console.log("Address is empty");
  } else if (!TonWeb.utils.Address.isValid(value)) {
    if (value.length === 64) {
      const publicKeyArr = TonWeb.utils.hexToBytes(value);
      const wallet = ton.wallet.create({ publicKey: publicKeyArr, wc: 0 });
      const walletAddress = await wallet.getAddress();
      showAddress(walletAddress.toString(true, true, true));
    } else {
      console.log("Not valid TON address or public key");
    }
  } else {
    showAddress(value);
  }
};
//-------------------------------------------------------------------------------

// const bip39 = require("bip39");
// const nacl = require("tonweb").nacl; // Используется для создания ключевой пары из сид-фразы

// const seedPhrase = "ваша сид-фраза здесь"; // Замените на вашу сид-фразу
// const recipient = "EQC..."; // Адрес получателя
// const amountToSend = "1"; // Количество TON для отправки

// // Инициализация TonWeb для основной сети
// const tonweb = new TonWeb(new TonWeb.HttpProvider("https://main.ton.dev"));
// const toNano = TonWeb.utils.toNano; // Функция для конвертации TON в нано-токены

// // Создание ключевой пары из сид-фразы
// const seed = bip39.mnemonicToSeedSync(seedPhrase).slice(0, 32);
// const keyPair = nacl.sign.keyPair.fromSeed(seed);

// // Инициализация кошелька
// const WalletClass = tonweb.wallet.all.v3R2; // Используем v3R2 кошелек; вы можете выбрать другой, если он лучше подходит для вашего случая
// const wallet = new WalletClass(tonweb.provider, {
//   publicKey: keyPair.publicKey,
//   wc: 0,
// });

// // Получение адреса кошелька
// wallet.getAddress().then((walletAddress) => {
//   console.log(
//     "Адрес вашего кошелька:",
//     walletAddress.toString(true, true, true)
//   );

//   // Создание и отправка транзакции
//   wallet
//     .createTransfer({
//       secretKey: keyPair.secretKey,
//       toAddress: recipient,
//       amount: toNano(amountToSend),
//       seqno: async () => await wallet.methods.seqno().call(),
//       payload: "",
//       sendMode: 3,
//     })
//     .send()
//     .then((hash) => {
//       console.log("Хэш транзакции:", hash);
//     })
//     .catch(console.error);
// });

app.listen(port, () => {
  console.log(`Прокси-сервер запущен на порту ${port}`);
});
