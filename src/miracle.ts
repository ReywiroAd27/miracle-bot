import path from "path"
import Pino, { Logger } from "pino" 
import { Boom } from "@hapi/boom"
import NodeCache from "node-cache"
import makeWASocket, {
  WAProto,
  Browsers,
  WASocket,
  DisconnectReason,
  makeInMemoryStore,
  jidNormalizedUser,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore
} from "baileys"

// set the logger
// memasang logget
const logger: Logger = Pino({ timestamp: () => `,"time":"${new Date().toJSON()}"` }, Pino.destination('./wa-logs.txt')).child({class: "baileys"})

/** English:
 *  the store maintains the data of the WA connection in memory
 *  can be written out to a file & read from it
 * 
 * Indonesia:
 * store menyimpan data koneksi WA dalam memori
 * dapat ditulis ke dalam sebuah file dan dibaca dari file tersebut
*/
const store: ReturnType<typeof makeInMemoryStore> | undefined = getFirstValid(
  global.config.getValue("useStore"),
  !(process.argv.includes("-s") || process.argv.includes("--no-store"))
  ) ? makeInMemoryStore({ logger }) : undefined
store?.readFromFile('./baileys_store_multi.json')
// save every 10s
// disimpan setiap 10 detik
setInterval(() => {
	store?.writeToFile('./baileys_store_multi.json')
}, 10000)  

/** English:
 *  external map to store retry counts of messages when decryption/encryption fails
 *  keep this out of the socket itself, so as to prevent a message decryption/encryption loop across socket restarts
 * 
 * Indonesia:
 * peta eksternal untuk menyimpan jumlah percobaan ulang pesan saat dekripsi/enkripsi gagal
 * jauhkan ini dari soket itu sendiri, untuk mencegah dekripsi pesan/pengulangan enkripsi di seluruh penghidupan ulang soket
**/
const msgRetryCounterCache = new NodeCache()

const usePairing = getFirstValid(
  global.config.getValue("usePairing"),
  process.argv.includes("--pairing") || process.argv.includes("-p")
)

// the main program
// program utama
async function main(): Promise<void> {
  process.on("unhandledRejection", (error) => (console.error(error),process.hitTotal++))
  
  const { state, saveCreds } = await useMultiFileAuthState(`./${global.config.getValue("sessionDir")}`)
   
   const miracle: WASocket = makeWASocket({
     logger, // hide log - menyembunyikan log
      printQRInTerminal: !usePairing, // popping up QR in terminal log - memunculkan QR di log terminal
      
      // mobile socket was removed in the latest baileys
      // soket seluler telah di hapus di dalam baileys terbaru
      /* mobile: useMobile, // mobile api (prone to bans) */
      
      auth: {
         creds: state.creds,
         keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      browser: Browsers.windows("Chrome"),
      markOnlineOnConnect: true, // set false for offline - pasang false untuk offline
      generateHighQualityLinkPreview: true, // make high preview link - membuat peninjau tautan berkualitas tinggi
      msgRetryCounterCache, // Resolve waiting messages - memperbaiki pesan tertunda
      defaultQueryTimeoutMs: undefined, // for this issues https://github.com/WhiskeySockets/Baileys/issues/276
      getMessage 	// implement to handle retries & poll updates - implementasi untuk mengatasi pembaruan retries & poll
   })
   
   // bind store, write store maybe
   // mengikat store, mungkin menulis store
   store?.bind(miracle.ev)
   
   // Pairing code for Web clients
   // Kode pemasangan untuk klien web
	if (usePairing && !miracle.authState.creds.registered) {
	  // make a loop
	  // membuat sebuah perulangan
		while (true) {
		    const phoneNumber = global.config.getValue("number",true) || await console.input('Please enter your phone number with your country code (example 62xxx):\n')
		    
		    // Ask again when entering the wrong number
		    // Tanyakan lagi saat memasukkan nomor yang salah
		    if (!Object.keys(require("../phonenumber-mcc.json")).some(v=>phoneNumber.startsWith(v))) continue
		    
		    const code = await miracle.requestPairingCode(phoneNumber)
		    if (!code) continue
		    console.info(`Pairing code: ${code}`)
		    break
		}
	}
	
	// write session
	// menulis sesi
	miracle.ev.on("creds.update", saveCreds);
	
	// connection handler, will reset automatically when the client is in trouble
	// pengendali koneksi, akan diatur ulang secara otomatis ketika klien bermasalah
	miracle.ev.on("connection.update", async (update) => {
    const { lastDisconnect, connection } = update
    if (connection) {
       console.info(`Connection Status : ${connection}`)
       console.info(`Status Koneksi : ${connection}`)
    }

    if (connection === "close") {
      let reason = new Boom(lastDisconnect?.error)?.output.statusCode
      if (reason === DisconnectReason.badSession) {
        console.error(`Bad Session File, Please Delete Session and Scan Again`)
        console.error(`File Sesi Buruk, Tolong Hapus Sesi Dan Pindai ulang`)
        process.send!('reset')
      } else if (reason === DisconnectReason.connectionClosed) {
        console.error("Connection closed, reconnecting....")
        console.error("Koneksi tertutup, sedang menyambungkan ulang....")
        await main()
      } else if (reason === DisconnectReason.connectionLost) {
        console.error("connection lost from server, reconnecting...")
        console.error("Koneksi hilang dari server, sedang menyambungkan ulang...")
        await main()
      } else if (reason === DisconnectReason.connectionReplaced) {
        console.error("Connection Replaced, Another New Session Opened, Please Close Current Session First")
        console.error("Koneksi Tertimpa, Sesi Baru Yang Lain Telah Terbuka, Tolong Tutup Dulu Sesi Tersebut")
        process.exit(1)
      } else if (reason === DisconnectReason.loggedOut) {
        console.error(`Device Logged Out, Please Scan Again And Run.`)
        console.error(`Perankat Telah Keluar, Tolong Pindai Ulang Dan Jalankan.`)
        process.exit(1)
      } else if (reason === DisconnectReason.restartRequired) {
        console.error("Restart Required, Restarting...")
        console.error("Pemulaian Ulang Dibutuhkan, Memulai Ulang...")
        await main()
      } else if (reason === DisconnectReason.timedOut) {
        console.error("Connection TimedOut, Reconnecting...")
        console.error("Waktu Koneksi Telah Habis, Menyambungkan Ulang...")
        process.send!('reset')
      } else {
        console.error(reason)
        process.send!('reset')
      }
    }

    // this is for bot connection testing with send a message to bot owner's
    if (connection === "open" && global.config.getValue("sendOnConnect")) {
      miracle.sendMessage(global.config.getValue("ownerNumbers")[0] + "@s.whatsapp.net", {
          text: `${miracle?.user?.name || "Miracle"} has Connected to account`,
      })
    }
  })
   
  miracle.ev.on("messages.upsert",async function(upsert){
    if (upsert.type !== "notify") return
    /** English 
     * default message handler is used plugin handler as default handler
     * if you want use switch-case handler, set useCase on configuration file with true
     * next you make a javascript file in main directory, not in src folder 
     * or you can set the file directory on caseDirectory at configuration
     * 
     * Indonesia
     * pengendali pesan biasa telah menggunakan pengendali plugin sebagai pengendali bawaan
     * jika kamu ingin menggunakan pengendali switch-case, setel useCase pada file konfigurasi dengan true
     * selanjutnya kamu membuat sebuah file javascript di dalam direktori utama, bukan di dalam berkas src
     * atau kamu bisa menyetel direktori file pada caseDirectory di konfigurasi  
    **/
    
    // don't spam
    if (upsert.messages.length <= 6) {
      for (const message of upsert.messages) {
        await messageHandler(miracle, await Serialize(miracle, message))
      }
    } else {
        await messageHandler(miracle, await Serialize(miracle, upsert.messages[0]))
    }
  })
}

async function getMessage(key: WAProto.IMessageKey): Promise<WAProto.IMessage | undefined> {
  if (key) {
    const jid = jidNormalizedUser(key.remoteJid!)
    const msg = await store?.loadMessage(jid!,key.id!)
    
    return msg?.message || undefined
  }
  
  // only if store is present
  // hanya jika store ada
	return WAProto.Message.fromObject({})
}

// start the main program
main()