// Crama 옷장 확장 100종 — gpt-image-1 (gen-wardrobe.js 방식 계승)
//   kind: part(모자·안경 단독 투명) / fitted(스카프·의상 — 바디 가이드 컨디셔닝) / floor / wall
//   사용법: node gen-wardrobe2.js            → 미생성분 전부 순차 생성(이미 있으면 스킵)
//          node gen-wardrobe2.js id1 id2    → 지정만
//          node gen-wardrobe2.js --seed     → wardrobe_items DB 시드만 적용(이미지 생성 없음)
//          node gen-wardrobe2.js --limit N  → 앞에서 N개만(배치 실행용)
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve('../site/public/img/wardrobe');
const BASE_REF = path.resolve('../site/public/img/generated/meerkat-baby-stand-noscarf.webp');

const STYLE =
  'Cute hand-drawn cartoon style with a rough black ink outline and flat colors with light crayon texture, ' +
  'matching a children-book mascot sticker look. Front view, centered, simple, no shadow, no text.';
const BG_STYLE =
  'Flat hand-drawn cartoon background surface with a soft crayon paper texture. ' +
  'ABSOLUTELY NO characters, NO animals, NO faces, NO objects, NO mascots — ' +
  'ONLY the flat background surface filling the entire frame edge to edge. No text, no shadow.';
const GUIDE = 'The attached image is a baby meerkat character used ONLY as a body-shape/position guide. Output a transparent PNG on the SAME canvas and SAME scale.';
const NEG_GARMENT = 'Do NOT draw the meerkat, its head, face, eyes, ears, arms, legs or tail — ONLY the garment fitted to the body position, everything else fully transparent. Rough hand-drawn crayon ink cartoon style, bold black outline matching the reference line weight.';
const NEG_SCARF = 'Do NOT draw the meerkat head/face/body, and do NOT draw any part that loops BEHIND the neck or behind the head — only the front-facing visible portion. Everything else fully transparent. Rough hand-drawn crayon ink cartoon style, bold black outline.';

// ── 카탈로그 100종 (id, name, price, rarity, kind, desc) ──
export const CATALOG = [
  // ━━ 모자 hat (22) ━━
  { id: 'hat_straw', name: '밀짚모자', slot: 'hat', price: 25, rarity: 'common', kind: 'part', desc: 'a round straw sun hat in warm golden tan with a small red ribbon band, front view, just the hat' },
  { id: 'hat_santa', name: '산타 모자', slot: 'hat', price: 40, rarity: 'common', kind: 'part', desc: 'a red santa claus hat with white fluffy trim and a white pom-pom drooping to one side, front view, just the hat' },
  { id: 'hat_wizard', name: '마법사 모자', slot: 'hat', price: 60, rarity: 'rare', kind: 'part', desc: 'a tall pointed wizard hat in deep purple with small golden stars and a slightly bent tip, front view, just the hat' },
  { id: 'hat_beret', name: '화가 베레모', slot: 'hat', price: 30, rarity: 'common', kind: 'part', desc: 'a soft artist beret in wine red tilted to one side, front view, just the beret' },
  { id: 'hat_detective', name: '탐정 모자', slot: 'hat', price: 45, rarity: 'common', kind: 'part', desc: 'a classic brown plaid deerstalker detective hat with ear flaps tied on top, front view, just the hat' },
  { id: 'hat_grad', name: '학사모', slot: 'hat', price: 45, rarity: 'common', kind: 'part', desc: 'a black graduation mortarboard cap with a golden tassel hanging on one side, front view, just the cap' },
  { id: 'hat_pumpkin', name: '호박 모자', slot: 'hat', price: 40, rarity: 'common', kind: 'part', desc: 'a cute halloween pumpkin-shaped hat in orange with a small green stem on top, front view, just the hat' },
  { id: 'hat_angel', name: '천사 링', slot: 'hat', price: 70, rarity: 'rare', kind: 'part', desc: 'a glowing golden angel halo ring floating, simple and clean, front view, just the halo' },
  { id: 'hat_devil', name: '악마 뿔', slot: 'hat', price: 70, rarity: 'rare', kind: 'part', desc: 'a pair of small cute red devil horns, front view, just the horns' },
  { id: 'hat_frog', name: '개구리 모자', slot: 'hat', price: 45, rarity: 'common', kind: 'part', desc: 'a cute green frog-face beanie hat with two big cartoon frog eyes on top, front view, just the hat' },
  { id: 'hat_bucket', name: '버킷햇', slot: 'hat', price: 30, rarity: 'common', kind: 'part', desc: 'a trendy beige bucket hat with stitching lines, front view, just the hat' },
  { id: 'hat_chick', name: '병아리 모자', slot: 'hat', price: 45, rarity: 'common', kind: 'part', desc: 'a fluffy yellow baby-chick beanie hat with a tiny orange beak and comb on top, front view, just the hat' },
  { id: 'hat_astro', name: '우주 헬멧', slot: 'hat', price: 90, rarity: 'rare', kind: 'part', desc: 'a white astronaut space helmet with a clear glass visor opening at the front, front view, just the helmet' },
  { id: 'hat_pirate', name: '해적 모자', slot: 'hat', price: 55, rarity: 'common', kind: 'part', desc: 'a black pirate tricorn hat with a white skull-and-crossbones mark, front view, just the hat' },
  { id: 'hat_sombrero', name: '솜브레로', slot: 'hat', price: 40, rarity: 'common', kind: 'part', desc: 'a wide-brim mexican sombrero in warm yellow with red zigzag trim, front view, just the hat' },
  { id: 'hat_viking', name: '바이킹 투구', slot: 'hat', price: 65, rarity: 'rare', kind: 'part', desc: 'a gray viking helmet with two small white horns and rivets, front view, just the helmet' },
  { id: 'hat_flower', name: '꽃 화관', slot: 'hat', price: 35, rarity: 'common', kind: 'part', desc: 'a spring flower crown wreath with small pink and white daisies and green leaves, front view, just the crown' },
  { id: 'hat_ribbon', name: '리본 머리핀', slot: 'hat', price: 20, rarity: 'common', kind: 'part', desc: 'a big cute red ribbon bow hair pin, front view, just the ribbon' },
  { id: 'hat_gat', name: '갓(전통모자)', slot: 'hat', price: 80, rarity: 'rare', kind: 'part', desc: 'a traditional Korean gat hat — wide round black horsehair brim with a tall cylindrical crown, semi-transparent black, front view, just the hat' },
  { id: 'hat_sleep', name: '수면 모자', slot: 'hat', price: 25, rarity: 'common', kind: 'part', desc: 'a cozy striped nightcap with a droopy tip and a small pom-pom, soft blue and white, front view, just the cap' },
  { id: 'hat_top', name: '신사 톱햇', slot: 'hat', price: 55, rarity: 'common', kind: 'part', desc: 'a classic black gentleman top hat with a dark red band, front view, just the hat' },
  { id: 'hat_ranger', name: '초록 캠핑햇', slot: 'hat', price: 30, rarity: 'common', kind: 'part', desc: 'a forest-green camping ranger hat with a chin strap, front view, just the hat' },

  // ━━ 안경 glasses (12) ━━
  { id: 'gls_monocle', name: '모노클', slot: 'glasses', price: 50, rarity: 'common', kind: 'part', desc: 'a single round gentleman monocle with a thin gold frame and a small hanging chain, front view, just the monocle' },
  { id: 'gls_goggle', name: '스팀펑크 고글', slot: 'glasses', price: 65, rarity: 'rare', kind: 'part', desc: 'brass steampunk goggles with round amber lenses and rivets on a leather strap front piece, front view, just the goggles' },
  { id: 'gls_swim', name: '물안경', slot: 'glasses', price: 30, rarity: 'common', kind: 'part', desc: 'cute blue swimming goggles with clear light-blue lenses, front view, just the goggles' },
  { id: 'gls_cyber', name: '사이버 바이저', slot: 'glasses', price: 80, rarity: 'rare', kind: 'part', desc: 'a futuristic neon-cyan cyber visor, one sleek translucent glowing band, front view, just the visor' },
  { id: 'gls_patch', name: '해적 안대', slot: 'glasses', price: 35, rarity: 'common', kind: 'part', desc: 'a black pirate eye patch with a thin strap, covering one eye position, front view, just the eye patch' },
  { id: 'gls_square', name: '네모 뿔테', slot: 'glasses', price: 25, rarity: 'common', kind: 'part', desc: 'square thick-rimmed hipster glasses in dark brown tortoise pattern with clear lenses, front view, just the glasses' },
  { id: 'gls_cat', name: '캣아이 안경', slot: 'glasses', price: 30, rarity: 'common', kind: 'part', desc: 'elegant cat-eye glasses with pointed upper corners in glossy red, clear lenses, front view, just the glasses' },
  { id: 'gls_shutter', name: '셔터 셰이드', slot: 'glasses', price: 40, rarity: 'common', kind: 'part', desc: 'retro party shutter shades sunglasses with horizontal slats in bright green, front view, just the glasses' },
  { id: 'gls_ski', name: '스키 고글', slot: 'glasses', price: 45, rarity: 'common', kind: 'part', desc: 'ski goggles with a big rounded mirror lens in gradient orange and a white frame, front view, just the goggles' },
  { id: 'gls_tears', name: '눈물 안경', slot: 'glasses', price: 35, rarity: 'common', kind: 'part', desc: 'funny clear glasses with big cartoon teardrops attached under each lens, front view, just the glasses' },
  { id: 'gls_money', name: '달러 선글라스', slot: 'glasses', price: 75, rarity: 'rare', kind: 'part', desc: 'novelty sunglasses where each lens is a green dollar-sign shape, gold frame, front view, just the glasses' },
  { id: 'gls_sleep', name: '수면 안대', slot: 'glasses', price: 25, rarity: 'common', kind: 'part', desc: 'a soft pink sleeping eye mask with two closed sleepy eyes drawn on it, front view, just the mask' },

  // ━━ 스카프·목 장식 scarf (10) ━━
  { id: 'scf_red', name: '빨강 목도리', slot: 'scarf', price: 20, rarity: 'common', kind: 'fitted', fit: 'scarf', desc: 'a chunky knitted scarf in warm red (#c0392b) wrapping the front of the neck and draping down the chest' },
  { id: 'scf_rainbow', name: '무지개 목도리', slot: 'scarf', price: 45, rarity: 'common', kind: 'fitted', fit: 'scarf', desc: 'a chunky knitted scarf with soft rainbow stripes wrapping the front of the neck and draping down the chest' },
  { id: 'scf_check', name: '체크 머플러', slot: 'scarf', price: 30, rarity: 'common', kind: 'fitted', fit: 'scarf', desc: 'a classic tartan plaid scarf in camel and brown check wrapping the front of the neck and draping down the chest' },
  { id: 'scf_bowtie', name: '나비넥타이', slot: 'scarf', price: 25, rarity: 'common', kind: 'fitted', fit: 'scarf', desc: 'a small neat black bow tie sitting at the front of the neck' },
  { id: 'scf_tie', name: '넥타이', slot: 'scarf', price: 30, rarity: 'common', kind: 'fitted', fit: 'scarf', desc: 'a business necktie in navy with diagonal light-blue stripes hanging down the chest from the neck' },
  { id: 'scf_gold', name: '금목걸이', slot: 'scarf', price: 90, rarity: 'rare', kind: 'fitted', fit: 'scarf', desc: 'a chunky gold chain necklace with a round gold coin pendant hanging on the chest' },
  { id: 'scf_pearl', name: '진주 목걸이', slot: 'scarf', price: 60, rarity: 'rare', kind: 'fitted', fit: 'scarf', desc: 'an elegant white pearl necklace resting around the front of the neck' },
  { id: 'scf_medal', name: '금메달', slot: 'scarf', price: 85, rarity: 'rare', kind: 'fitted', fit: 'scarf', desc: 'a gold medal with a number-one mark hanging on a red-white-blue ribbon around the neck down the chest' },
  { id: 'scf_camera', name: '목걸이 카메라', slot: 'scarf', price: 40, rarity: 'common', kind: 'fitted', fit: 'scarf', desc: 'a small cute retro camera hanging from a neck strap on the chest' },
  { id: 'scf_bell', name: '방울 목걸이', slot: 'scarf', price: 25, rarity: 'common', kind: 'fitted', fit: 'scarf', desc: 'a red collar band with a small golden jingle bell at the front of the neck' },

  // ━━ 의상 outfit (24) ━━
  { id: 'out_hanbok', name: '색동 한복', slot: 'outfit', price: 95, rarity: 'rare', kind: 'fitted', fit: 'garment', desc: 'a traditional Korean hanbok jacket with rainbow saekdong striped sleeves and a neat ribbon knot on the chest, fitted on the torso and arms' },
  { id: 'out_tux', name: '턱시도', slot: 'outfit', price: 80, rarity: 'rare', kind: 'fitted', fit: 'garment', desc: 'a classy black tuxedo jacket with white shirt front and a black bow tie, fitted on the torso' },
  { id: 'out_track', name: '츄리닝', slot: 'outfit', price: 30, rarity: 'common', kind: 'fitted', fit: 'garment', desc: 'a comfy navy tracksuit jacket with white side stripes and a front zipper, fitted on the torso and arms' },
  { id: 'out_pajama', name: '줄무늬 잠옷', slot: 'outfit', price: 30, rarity: 'common', kind: 'fitted', fit: 'garment', desc: 'a cozy light-blue striped pajama shirt with buttons, fitted on the torso and arms' },
  { id: 'out_raincoat', name: '노랑 비옷', slot: 'outfit', price: 35, rarity: 'common', kind: 'fitted', fit: 'garment', desc: 'a bright yellow rain coat with a hood down on the back and big buttons, fitted on the torso and arms' },
  { id: 'out_lifevest', name: '구명조끼', slot: 'outfit', price: 35, rarity: 'common', kind: 'fitted', fit: 'garment', desc: 'an orange life vest with buckle straps, fitted on the torso' },
  { id: 'out_soccer', name: '축구 유니폼', slot: 'outfit', price: 45, rarity: 'common', kind: 'fitted', fit: 'garment', desc: 'a red soccer jersey with white trim and the number 7, fitted on the torso and arms' },
  { id: 'out_baseball', name: '야구 유니폼', slot: 'outfit', price: 45, rarity: 'common', kind: 'fitted', fit: 'garment', desc: 'a white baseball jersey with navy pinstripes and buttons, fitted on the torso and arms' },
  { id: 'out_taekwondo', name: '태권도복', slot: 'outfit', price: 50, rarity: 'common', kind: 'fitted', fit: 'garment', desc: 'a white taekwondo dobok jacket with a black belt tied at the waist, fitted on the torso and arms' },
  { id: 'out_apron', name: '요리사 앞치마', slot: 'outfit', price: 30, rarity: 'common', kind: 'fitted', fit: 'garment', desc: 'a red cooking apron with a front pocket and neck strap, fitted on the torso' },
  { id: 'out_hero', name: '히어로 망토', slot: 'outfit', price: 85, rarity: 'rare', kind: 'fitted', fit: 'garment', desc: 'a superhero outfit: blue chest suit with a yellow star emblem and a red cape visible at the shoulders, fitted on the torso' },
  { id: 'out_dracula', name: '드라큘라 망토', slot: 'outfit', price: 70, rarity: 'rare', kind: 'fitted', fit: 'garment', desc: 'a black vampire cape with a tall red-lined collar rising behind the neck and a red bow at the front, fitted on the torso' },
  { id: 'out_santa', name: '산타 코트', slot: 'outfit', price: 60, rarity: 'common', kind: 'fitted', fit: 'garment', desc: 'a red santa coat with white fluffy trim and a black belt with golden buckle, fitted on the torso and arms' },
  { id: 'out_cowboy', name: '카우보이 조끼', slot: 'outfit', price: 45, rarity: 'common', kind: 'fitted', fit: 'garment', desc: 'a brown leather cowboy vest with fringe and a sheriff star badge, fitted on the torso' },
  { id: 'out_doctor', name: '의사 가운', slot: 'outfit', price: 55, rarity: 'common', kind: 'fitted', fit: 'garment', desc: 'a white doctor coat over a shirt with a stethoscope around the neck, fitted on the torso and arms' },
  { id: 'out_police', name: '경찰 제복', slot: 'outfit', price: 55, rarity: 'common', kind: 'fitted', fit: 'garment', desc: 'a navy police uniform shirt with a golden badge and shoulder straps, fitted on the torso and arms' },
  { id: 'out_fire', name: '소방관 재킷', slot: 'outfit', price: 55, rarity: 'common', kind: 'fitted', fit: 'garment', desc: 'a firefighter turnout jacket in dark tan with neon-yellow reflective stripes and clasps, fitted on the torso and arms' },
  { id: 'out_space', name: '우주복', slot: 'outfit', price: 95, rarity: 'rare', kind: 'fitted', fit: 'garment', desc: 'a white astronaut space suit with a chest control panel and mission patches, fitted on the torso and arms' },
  { id: 'out_hoodie', name: '개발자 후드티', slot: 'outfit', price: 40, rarity: 'common', kind: 'fitted', fit: 'garment', desc: 'a dark gray hoodie with drawstrings and a front pocket, hood down on the back, fitted on the torso and arms' },
  { id: 'out_vest', name: '경제신문 조끼', slot: 'outfit', price: 50, rarity: 'common', kind: 'fitted', fit: 'garment', desc: 'a classic gray suit vest over a white shirt with a small folded newspaper tucked at the chest pocket, fitted on the torso' },
  { id: 'out_reindeer', name: '순록 스웨터', slot: 'outfit', price: 45, rarity: 'common', kind: 'fitted', fit: 'garment', desc: 'a cozy winter knit sweater in dark green with a reindeer and snowflake pattern, fitted on the torso and arms' },
  { id: 'out_hawaii', name: '하와이안 셔츠', slot: 'outfit', price: 40, rarity: 'common', kind: 'fitted', fit: 'garment', desc: 'a bright teal hawaiian shirt with white hibiscus flower pattern, short sleeves, fitted on the torso' },
  { id: 'out_padding', name: '롱패딩', slot: 'outfit', price: 65, rarity: 'rare', kind: 'fitted', fit: 'garment', desc: 'a puffy black long padded winter coat with a zipper and high collar, quilted segments, fitted on the torso and arms' },
  { id: 'out_school', name: '교복 블레이저', slot: 'outfit', price: 45, rarity: 'common', kind: 'fitted', fit: 'garment', desc: 'a neat navy school uniform blazer with a crest patch and a striped tie, fitted on the torso and arms' },

  // ━━ 바닥 floor (14) ━━
  { id: 'flr_ondol', name: '온돌 장판', slot: 'floor', price: 25, rarity: 'common', kind: 'floor', desc: 'a warm yellowish-amber Korean ondol vinyl floor with subtle rectangular sheen patterns, gentle top-down angle, hand-drawn cartoon, seamless horizontal' },
  { id: 'flr_snow', name: '눈밭', slot: 'floor', price: 30, rarity: 'common', kind: 'floor', desc: 'a soft white snow ground with gentle sparkles and small mounds, hand-drawn cartoon, seamless horizontal' },
  { id: 'flr_sakura', name: '벚꽃잎 바닥', slot: 'floor', price: 40, rarity: 'common', kind: 'floor', desc: 'a ground covered with soft pink cherry blossom petals, hand-drawn cartoon, seamless horizontal' },
  { id: 'flr_lava', name: '용암 바닥', slot: 'floor', price: 75, rarity: 'rare', kind: 'floor', desc: 'a cartoon lava floor with glowing orange cracks on dark rock, playful not scary, hand-drawn, seamless horizontal' },
  { id: 'flr_ocean', name: '바닷속 모래', slot: 'floor', price: 40, rarity: 'common', kind: 'floor', desc: 'an underwater sandy seabed with small shells and a starfish, soft blue tint, hand-drawn cartoon, seamless horizontal' },
  { id: 'flr_chess', name: '체스판', slot: 'floor', price: 35, rarity: 'common', kind: 'floor', desc: 'a glossy black and white chessboard floor, gentle top-down angle, hand-drawn cartoon, seamless horizontal' },
  { id: 'flr_coins', name: '금화 더미', slot: 'floor', price: 100, rarity: 'rare', kind: 'floor', desc: 'a floor completely covered with shiny golden coins piled up, sparkling, hand-drawn cartoon, seamless horizontal' },
  { id: 'flr_bills', name: '지폐 카펫', slot: 'floor', price: 90, rarity: 'rare', kind: 'floor', desc: 'a floor carpeted with overlapping green cartoon banknotes, hand-drawn cartoon, seamless horizontal' },
  { id: 'flr_persian', name: '페르시안 러그', slot: 'floor', price: 50, rarity: 'common', kind: 'floor', desc: 'an ornate persian rug floor in deep red with intricate cream patterns and fringe, hand-drawn cartoon, seamless horizontal' },
  { id: 'flr_leaves', name: '가을 낙엽', slot: 'floor', price: 30, rarity: 'common', kind: 'floor', desc: 'a ground covered with warm autumn leaves in orange, red and brown, hand-drawn cartoon, seamless horizontal' },
  { id: 'flr_rainbow', name: '무지개 바닥', slot: 'floor', price: 55, rarity: 'common', kind: 'floor', desc: 'a soft pastel rainbow-striped floor, dreamy and cute, hand-drawn cartoon, seamless horizontal' },
  { id: 'flr_ice', name: '얼음 바닥', slot: 'floor', price: 40, rarity: 'common', kind: 'floor', desc: 'a pale blue ice floor with subtle cracks and shine streaks, hand-drawn cartoon, seamless horizontal' },
  { id: 'flr_pitch', name: '축구장 잔디', slot: 'floor', price: 35, rarity: 'common', kind: 'floor', desc: 'a soccer pitch grass floor with mowed light-dark green stripes and a white line, hand-drawn cartoon, seamless horizontal' },
  { id: 'flr_tatami', name: '다다미', slot: 'floor', price: 30, rarity: 'common', kind: 'floor', desc: 'a woven tatami mat floor in soft green-beige with dark edge bands, gentle top-down angle, hand-drawn cartoon, seamless horizontal' },

  // ━━ 벽지 wallpaper (18) ━━
  { id: 'wal_sakura', name: '벚꽃 벽지', slot: 'wallpaper', price: 45, rarity: 'common', kind: 'wall', desc: 'a soft pink wall with falling cherry blossom petals and a few branches, flat hand-drawn cartoon background' },
  { id: 'wal_autumn', name: '단풍 벽지', slot: 'wallpaper', price: 40, rarity: 'common', kind: 'wall', desc: 'a warm cream wall with scattered red and orange maple leaves, flat hand-drawn cartoon background' },
  { id: 'wal_snownight', name: '눈 오는 밤', slot: 'wallpaper', price: 45, rarity: 'common', kind: 'wall', desc: 'a deep blue night wall with softly falling white snowflakes, flat hand-drawn cartoon background' },
  { id: 'wal_neon', name: '네온 시티', slot: 'wallpaper', price: 80, rarity: 'rare', kind: 'wall', desc: 'a dark city-night wall with glowing pink and cyan neon sign shapes and building silhouettes, flat hand-drawn cartoon background' },
  { id: 'wal_arcade', name: '아케이드 도트', slot: 'wallpaper', price: 60, rarity: 'common', kind: 'wall', desc: 'a retro arcade wall in dark purple with pixel-style dots, hearts and small invader shapes, flat hand-drawn cartoon background' },
  { id: 'wal_chalk', name: '칠판 벽', slot: 'wallpaper', price: 35, rarity: 'common', kind: 'wall', desc: 'a dark green chalkboard wall with faint white chalk doodles of stars and formulas, flat hand-drawn cartoon background' },
  { id: 'wal_news', name: '신문지 벽', slot: 'wallpaper', price: 35, rarity: 'common', kind: 'wall', desc: 'a wall papered with old beige newspaper sheets with unreadable blurry column blocks, no legible text, flat hand-drawn cartoon background' },
  { id: 'wal_brick', name: '벽돌 벽', slot: 'wallpaper', price: 30, rarity: 'common', kind: 'wall', desc: 'a warm red-brown brick wall with cream mortar lines, flat hand-drawn cartoon background' },
  { id: 'wal_graffiti', name: '그래피티 벽', slot: 'wallpaper', price: 55, rarity: 'common', kind: 'wall', desc: 'a light concrete wall with colorful abstract graffiti swooshes and splashes, no letters, flat hand-drawn cartoon background' },
  { id: 'wal_aurora', name: '오로라 벽지', slot: 'wallpaper', price: 85, rarity: 'rare', kind: 'wall', desc: 'a dark polar night wall with flowing green and purple aurora curtains and tiny stars, flat hand-drawn cartoon background' },
  { id: 'wal_sunset', name: '노을 벽지', slot: 'wallpaper', price: 45, rarity: 'common', kind: 'wall', desc: 'a warm gradient sunset wall from orange to pink with a few thin clouds, flat hand-drawn cartoon background' },
  { id: 'wal_undersea', name: '바닷속 벽지', slot: 'wallpaper', price: 50, rarity: 'common', kind: 'wall', desc: 'an underwater blue wall with rising bubbles, seaweed silhouettes and light rays, flat hand-drawn cartoon background' },
  { id: 'wal_bamboo', name: '대나무숲', slot: 'wallpaper', price: 40, rarity: 'common', kind: 'wall', desc: 'a fresh green bamboo forest wall with vertical bamboo stalks and leaves, flat hand-drawn cartoon background' },
  { id: 'wal_xmas', name: '크리스마스 벽', slot: 'wallpaper', price: 50, rarity: 'common', kind: 'wall', desc: 'a festive deep green wall with a garland, small ornaments, string lights and snowflakes, flat hand-drawn cartoon background' },
  { id: 'wal_firework', name: '불꽃놀이 벽', slot: 'wallpaper', price: 55, rarity: 'common', kind: 'wall', desc: 'a night-sky wall with colorful cartoon firework bursts, flat hand-drawn cartoon background' },
  { id: 'wal_chart', name: '떡상 차트 벽', slot: 'wallpaper', price: 95, rarity: 'rare', kind: 'wall', desc: 'a dark navy wall with a big glowing green rising stock chart line going up to the right with candlestick bars, playful cartoon style, no text, flat hand-drawn background' },
  { id: 'wal_honey', name: '허니콤 벽지', slot: 'wallpaper', price: 35, rarity: 'common', kind: 'wall', desc: 'a warm yellow honeycomb hexagon pattern wall with a few honey drips, flat hand-drawn cartoon background' },
  { id: 'wal_library', name: '서재 벽', slot: 'wallpaper', price: 45, rarity: 'common', kind: 'wall', desc: 'a cozy wall of wooden bookshelves filled with colorful book spines, no text, flat hand-drawn cartoon background' },
];

// ── 이미지 생성 ──
async function genImage(prompt, transparent) {
  const body = { model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1', prompt, size: '1024x1024', n: 1 };
  if (transparent) body.background = 'transparent';
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('OpenAI error: ' + (await res.text()));
  const b64 = (await res.json()).data?.[0]?.b64_json;
  if (!b64) throw new Error('빈 응답');
  return Buffer.from(b64, 'base64');
}
async function editFitted(prompt) {
  const png = await sharp(await fs.readFile(BASE_REF)).png().toBuffer();
  const fd = new FormData();
  fd.set('model', process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1');
  fd.set('prompt', prompt);
  fd.set('size', '1024x1024');
  fd.set('background', 'transparent');
  fd.append('image[]', new Blob([png], { type: 'image/png' }), 'ref.png');
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: fd,
  });
  if (!res.ok) throw new Error('OpenAI edits error: ' + (await res.text()));
  const b64 = (await res.json()).data?.[0]?.b64_json;
  if (!b64) throw new Error('빈 응답');
  return Buffer.from(b64, 'base64');
}
async function save(item, buf) {
  const file = path.join(OUT, `${item.id}.webp`);
  let img = sharp(buf);
  if (item.kind === 'part') img = img.resize({ width: 512, height: 512, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  else if (item.kind === 'fitted') img = img.resize({ width: 768, height: 768, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  else if (item.kind === 'floor') img = img.resize({ width: 768, height: 320, fit: 'cover', position: 'centre' });
  else img = img.resize({ width: 768, height: 960, fit: 'cover', position: 'centre' });
  await img.webp({ quality: 84, alphaQuality: 100 }).toFile(file);
}
async function exists(id) {
  try { await fs.access(path.join(OUT, `${id}.webp`)); return true; } catch { return false; }
}

// ── DB 시드 ──
async function seed() {
  const { pgConn } = await import('./lib/push.js');
  const pg = (await import('pg')).default;
  const c = new pg.Client(pgConn());
  await c.connect();
  let n = 0;
  const sortBase = { hat: 100, glasses: 100, scarf: 100, outfit: 100, floor: 100, wallpaper: 100 };
  for (const it of CATALOG) {
    if (!(await exists(it.id))) continue; // 이미지 있는 것만 등록(뽑기에서 빈 이미지 방지)
    await c.query(
      `insert into wardrobe_items (id, name, slot, price_worms, rarity, asset_url, sort)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (id) do update set name=excluded.name, slot=excluded.slot, price_worms=excluded.price_worms, rarity=excluded.rarity, asset_url=excluded.asset_url`,
      [it.id, it.name, it.slot, it.price, it.rarity, `/img/wardrobe/${it.id}.webp`, sortBase[it.slot]++]
    );
    n++;
  }
  const t = await c.query('select count(*) n from wardrobe_items');
  console.log(`시드 완료: ${n}건 반영 · 카탈로그 총 ${t.rows[0].n}종`);
  await c.end();
}

// ── 실행 ──
const args = process.argv.slice(2);
if (args.includes('--seed')) { await seed(); process.exit(0); }
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? Number(args[limitIdx + 1]) : Infinity;
const ids = args.filter((a) => !a.startsWith('--') && a !== String(limit));

await fs.mkdir(OUT, { recursive: true });
let targets = ids.length ? CATALOG.filter((p) => ids.includes(p.id)) : CATALOG;
if (!ids.length) {
  const pending = [];
  for (const it of targets) if (!(await exists(it.id))) pending.push(it);
  targets = pending;
}
targets = targets.slice(0, limit);
console.log(`생성 대상 ${targets.length}건`);

let ok = 0, fail = 0;
for (const item of targets) {
  process.stdout.write(`▶ ${item.id} (${item.name}) ... `);
  try {
    let buf;
    if (item.kind === 'fitted') {
      const neg = item.fit === 'scarf' ? NEG_SCARF : NEG_GARMENT;
      buf = await editFitted(`${GUIDE} Draw ONLY ${item.desc}. ${neg}`);
    } else if (item.kind === 'part') {
      const extra = item.id.startsWith('gls_') ? ' Show ONLY the FRONT piece with NO side temple arms or straps going back, as if just the front is perched on the face.' : '';
      buf = await genImage(`${item.desc}.${extra} ${STYLE} On a fully transparent background — only the object, nothing else, no character, no background.`, true);
    } else {
      buf = await genImage(`${item.desc}. ${BG_STYLE}`, false);
    }
    await save(item, buf);
    ok++;
    console.log('완료');
  } catch (e) {
    fail++;
    console.log('실패:', e.message.slice(0, 120));
  }
}
console.log(`\n완료: 성공 ${ok} / 실패 ${fail} — 남은 미생성분은 재실행 시 이어서 생성됩니다.`);
