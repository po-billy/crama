// Azure Neural TTS — SSML <bookmark> 로 청크별 시작 시각(ms)을 받아 하이라이트 싱크에 사용.
// 무료 F0 티어: 월 50만 자(매달 영구). 음성 예: ko-KR-SunHiNeural, ko-KR-InJoonNeural.
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

const TICKS_PER_MS = 10000; // Azure offset 단위(100ns)

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 청크 앞에 <bookmark mark="cN"/> 를 넣어 각 청크의 오디오 시작 시각을 회수
export function buildSsml(chunks, voice, rate = '0%') {
  const body = chunks.map((c, i) => `<bookmark mark="c${i}"/>${escapeXml(c)}`).join(' ');
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ko-KR">` +
    `<voice name="${voice}"><prosody rate="${rate}">${body}</prosody></voice></speak>`
  );
}

// SSML → { audio(Buffer, mp3), marks:[{mark,t}], durationMs }
export function synthesize({ key, region, ssml }) {
  return new Promise((resolve, reject) => {
    const cfg = sdk.SpeechConfig.fromSubscription(key, region);
    cfg.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
    // audioConfig=null → 스피커로 출력하지 않고 result.audioData 로만 회수(헤드리스)
    const synth = new sdk.SpeechSynthesizer(cfg, null);
    const marks = [];
    synth.bookmarkReached = (_s, e) => {
      marks.push({ mark: e.text, t: Math.round(e.audioOffset / TICKS_PER_MS) });
    };
    synth.speakSsmlAsync(
      ssml,
      (result) => {
        try {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            resolve({
              audio: Buffer.from(result.audioData),
              marks,
              durationMs: Math.round((result.audioDuration || 0) / TICKS_PER_MS),
            });
          } else {
            reject(new Error('Azure 합성 실패: ' + (result.errorDetails || result.reason)));
          }
        } finally {
          synth.close();
        }
      },
      (err) => {
        synth.close();
        reject(err);
      },
    );
  });
}
