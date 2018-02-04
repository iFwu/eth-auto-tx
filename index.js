const Web3 = require('web3')
const util = require('ethereumjs-util')
const EthereumTx = require('ethereumjs-tx')
const abi = require('human-standard-token-abi')
const Table = require('cli-table2')
const opn = require('opn')
const clipMonit = require('clipboard-monitor')
const notifier = require('node-notifier')
const QrCode = require('qrcode-reader')
const Jimp = require("jimp")
const screenshot = require('screenshot-desktop')

const address = {
  test: '0x0000000000000000000000000000000000000000',
  prod: '0xffffffffffffffffffffffffffffffffffffffff',
}

const privateKey = {
  [address.test]: new Buffer('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'hex'),
  [address.prod]: new Buffer('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'hex'),
}

// const web3 = new Web3(new Web3.providers.HttpProvider('https://api.myetherapi.com/eth'))
// const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/1eqvdRndI0ePBx7ciN7u'))
// const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
const web3 = new Web3(new Web3.providers.HttpProvider('https://api.mycryptoapi.com/eth'))

web3.eth.defaultAccount = address.prod

const contractAddress = '0xf85fEea2FdD81d51177F6b8F35F0e6734Ce45F5F'
const token = web3.eth.contract(abi).at(contractAddress)

const ethToSend = 3
const cmtToSend = 7500

const main = async () => {
  const nonce = web3.eth.getTransactionCount(web3.eth.defaultAccount)
  const gasPrices = '60'
  // showBalance()
  console.log(`The outgoing transaction count for your wallet address is: ${nonce}`)

  const monitor = clipMonit(100)

  let timer

  var addressPromise = new Promise(resolve => {
    let firstCopy = true
    monitor.on('copy', function (data) {
      //do something with the data
      if (firstCopy) {
        firstCopy = false
        return
      }
      if (web3.isAddress(data.trim())) {
        resolve({
          address: data.trim(),
          src: '剪贴板'
        })
      }
    })
    timer = setInterval(async () => {
      const t = Date.now()
      const capture = await screenshot()
      Jimp.read(capture, function (err, image) {
        if (err) {
          console.error(err)
          return
        }
        var qr = new QrCode();
        qr.callback = function (err, value) {
          if (value && value.result) {
            const qrAddress = value.result.replace('ethereum:', '').trim()
            if (web3.isAddress(qrAddress)) {
              resolve({
                address: qrAddress,
                src: '二维码'
              })
            }
          }
        }
        qr.decode(image.bitmap)
      })
    }, 200)

  })

  const addressInfo = await addressPromise

  sendMoney(addressInfo)

  function sendMoney ({ address: sendTo, src }) {
    const sendFrom = web3.eth.defaultAccount

    console.log(sendTo)
    monitor.end()
    clearInterval(timer)
    notifier.notify({
      title: `发送成功，来源：${src}`,
      message: sendTo
    })

    const details_eth = {
      "to": sendTo,
      "from": sendFrom,
      "value": web3.toHex(web3.toWei(ethToSend, 'ether')),
      "gasLimit": 200000,
      "gasPrice": gasPrices * 1000000000, // converts the gwei price to wei
      "nonce": nonce,
      "chainId": 1 // EIP 155 chainId - mainnet: 1, rinkeby: 4
    }

    const cmtData = token.transfer.getData(sendTo, web3.toHex(web3.toWei(cmtToSend, 'ether')), {
      from: sendFrom
    })

    const details_cmt = {
      "to": contractAddress,
      "from": sendFrom,
      "value": web3.toHex(0),
      "gasLimit": 200000,
      "gasPrice": gasPrices * 1000000000, // converts the gwei price to wei
      "nonce": nonce + 1,
      "data": cmtData,
      "chainId": 1 // EIP 155 chainId - mainnet: 1, rinkeby: 4
    }

    const transaction_eth = new EthereumTx(details_eth)
    const transaction_cmt = new EthereumTx(details_cmt)

    transaction_eth.sign(Buffer.from(privateKey[sendFrom], 'hex'))
    transaction_cmt.sign(Buffer.from(privateKey[sendFrom], 'hex'))

    const serializedTransaction_eth = transaction_eth.serialize()
    const serializedTransaction_cmt = transaction_cmt.serialize()

    const t = Date.now()

    // web3.eth.sendRawTransaction('0x' + serializedTransaction_eth.toString('hex'), function (error, transactionId) {
    //   if (!error) {
    //     const url = `https://etherscan.io/tx/${transactionId}`
    //     console.log('Time ETH: ', Date.now() - t)
    //     console.log(`ETH: ${url}`)
    //     opn(url, {
    //       wait: false
    //     })
    //   } else {
    //     console.error(error)
    //   }
    // })

    web3.eth.sendRawTransaction('0x' + serializedTransaction_cmt.toString('hex'), function (error, transactionId) {
      if (!error) {
        const url = `https://etherscan.io/tx/${transactionId}`
        console.log('Time CMT: ', Date.now() - t)
        console.log(`CMT: ${url}`)
        opn(url, {
          wait: false
        })
      } else {
        console.error(error)
      }
    })
  }
  // sendMoney({
  //   address: address.test,
  //   src: '手动'
  // })
}

main()

function showBalance () {
  const table = new Table({
    head: ['Now', 'Name', 'ETH', 'CMT', 'Address']
  })

  const t = Date.now()
  table.push([
    address.test === web3.eth.defaultAccount && '✓' || '',
    'Test',
    web3.fromWei(web3.eth.getBalance(address.test).toNumber(), 'ether'),
    web3.fromWei(token.balanceOf.call(address.test).toString(10), 'ether'),
    address.test,
  ])
  table.push([
    address.prod === web3.eth.defaultAccount && '✓' || '',
    'Prod',
    web3.fromWei(web3.eth.getBalance(address.prod).toNumber(), 'ether'),
    web3.fromWei(token.balanceOf.call(address.prod).toString(10), 'ether'),
    address.prod,
  ])

  console.log(table.toString(), `\nuse ${Date.now() - t}ms`)
}
