import "./style.css";
import AgoraRTC from "agora-rtc-sdk-ng";
import axios from "axios";
// import AgoraRTM from "agora-rtm-sdk";

const URL_SERVER = "http://lolvoipserver-production.up.railway.app";

const appid = "dd7fa6de537b4faeb3fe895d06bf60ff";
const token = null;
const rtcUid = Math.floor(Math.random() * 2032);
// const rtmUid = String(Math.floor(Math.random() * 2032));

let roomId = "TEST";

let audioTracks = {
  localAudioTrack: null,
  remoteAudioTracks: {},
};

let summonername = "";
let rtcClient;
// let rtmClient;
// let channel;

let micMuted = true;

// const initRtm = async (name) => {
//   rtmClient = AgoraRTM.createInstance(appid);
//   await rtmClient.login({ uid: rtmUid, token: null });

//   channel = rtmClient.createChannel(roomId);
//   await channel.join();

//   window.addEventListener("beforeunload", leaveRtmChannel);
// };

// let leaveRtmChannel = async () => {
//   await channel.leave();
//   await rtmClient.logout();
// };

let initRtc = async () => {
  rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

  rtcClient.on("user-joined", handleUserJoined);
  rtcClient.on("user-published", handleUserPublished);
  rtcClient.on("user-left", handleUserLeft);

  await rtcClient.join(appid, roomId, token, rtcUid); //rtcUid
  audioTracks.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
  audioTracks.localAudioTrack.setMuted(micMuted);
  await rtcClient.publish(audioTracks.localAudioTrack);

  let userWrapper = `<div class="speaker user-${rtcUid}" id="${rtcUid}">
    <p>${rtcUid}</p>
  </div>`; //rtcUid

  document
    .getElementById("members")
    .insertAdjacentHTML("beforeend", userWrapper);

  initVolumeIndicator();
};

let handleUserJoined = async (user) => {
  console.log("NOVO USER ENTROU:", user);
  let userWrapper = `<div class="speaker user-${user.uid}" id="${user.uid}">
  <p>${user.uid}</p>
  </div>`;

  document
    .getElementById("members")
    .insertAdjacentHTML("beforeend", userWrapper);
};

let handleUserPublished = async (user, mediaType) => {
  await rtcClient.subscribe(user, mediaType);

  if (mediaType === "audio") {
    audioTracks.remoteAudioTracks[user.uid] = [user.audioTrack];
    user.audioTrack.play();
  }
};

let handleUserLeft = async (user) => {
  delete audioTracks.remoteAudioTracks[user.uid];
  document.getElementById(user.uid).remove();
};

// let handleMemberJoined = async (MemberId) => {
//   let { name, userRtcUid } = await rtmClient.getUserAttributesByKeys(MemberId, [
//     "name",
//     "userRtcUid",
//   ]);

//   let newMember = `
//   <div class="speaker user-${userRtcUid}" id="${MemberId}">
//       <p>${name}</p>
//   </div>`;

//   document.getElementById("members").insertAdjacentHTML("beforeend", newMember);
// };

let initVolumeIndicator = () => {
  AgoraRTC.setParameter("AUDIO_VOLUME_INDICATION_INTERVAL", 200);
  rtcClient.enableAudioVolumeIndicator();

  rtcClient.on("volume-indicator", (volume) => {
    volume.forEach((volume) => {
      console.log("volumes:", volume, "UID:", volume.uid);

      try {
        let item = document.getElementById(volume.uid);

        if (volume.level >= 50) {
          item.style.borderColor = "#00ff00";
        } else {
          item.style.borderColor = "#fff";
        }
      } catch (error) {
        //console.log('error:', error);
      }
    });
  });
};

const toggleMic = async (e) => {
  if (micMuted) {
    e.target.src = "icons/mic.svg";
    e.target.style.backgroundColor = "ivory";
    micMuted = false;
  } else {
    e.target.src = "icons/mic-off.svg";
    e.target.style.backgroundColor = "indianred";
    micMuted = true;
  }

  audioTracks.localAudioTrack.setMuted(micMuted);
};

//---------------------------------------------------------------------------

let lobbyForm = document.getElementById("form");

const enterRoom = async (e) => {
  summonername = document.getElementById("summonername").value;
  e.preventDefault();

  if (summonername != "") {
    const puuid = await getPuuid(summonername);
    console.log("PUUID obtido:", puuid);

    if (puuid != null) {
      const matchFound = await getPartida(puuid);
      console.log("Match obtido:", matchFound);

      if (matchFound.data != null) {
        console.log(`${matchFound.data.gameId}${matchFound.data.teamId}`);
        roomId = `${matchFound.data.gameId}${matchFound.data.teamId}`;
        initRtc();
        // initRtm(displayName);
        document.getElementById("room-name").innerText = "Sala: " + roomId;
        lobbyForm.style.display = "none";
        document.getElementById("room-header").style.display = "flex";
      } else {
        alert("Partida nao encontrada para o usuario informado.");
      }
    } else {
      alert("Usuario nao encontrado, verifique o usuario informado");
    }
  } else {
    alert("informe o seu usuario.");
  }
};

let leaveRoom = async () => {
  audioTracks.localAudioTrack.stop();
  audioTracks.localAudioTrack.close();

  rtcClient.unpublish();
  rtcClient.leave();

  // leaveRtmChannel();

  document.getElementById("form").style.display = "block";
  document.getElementById("room-header").style.display = "none";
  document.getElementById("members").innerHTML = "";
};

lobbyForm.addEventListener("submit", enterRoom);

document.getElementById("leave-icon").addEventListener("click", leaveRoom);
document.getElementById("mic-icon").addEventListener("click", toggleMic);

//----------------------- RIOT request below ================
const getPuuid = async (username) => {
  try {
    const [summonerName, tagLine] = username.split("#");

    const response = await axios.get(`${URL_SERVER}/getUserID`, {
      params: { summonerName, tagLine },
    });

    console.log("PUUID:", response.data.puuid);
    return response.data.puuid;
  } catch (err) {
    console.error("Erro ao buscar PUUID:", err);
    return null;
  }
};

const getPartida = async (puuid) => {
  console.log("Entrou n funcao getPartida");
  try {
    const response = await axios.get(
      `${URL_SERVER}/getActiveGame?puuid=${encodeURIComponent(puuid)}`
    );

    return response.data;
  } catch (error) {
    console.error("Erro ao buscar partida:", err);
    return null;
  }
};
