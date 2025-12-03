import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'crama',
  brand: {
    displayName: 'crama', // 화면에 노출될 앱의 한글 이름으로 바꿔주세요.
    primaryColor: '#38f28b', // 화면에 노출될 앱의 기본 색상으로 바꿔주세요.
    icon: 'assets/crama-logo1.png', // 화면에 노출될 앱의 아이콘 이미지 주소로 바꿔주세요.
    bridgeColorMode: 'basic',
  },
  web: {
    host: '220.85.58.253',
    port: 3000,
    commands: {
      dev: 'dev crama --host',
      build: 'build crama',
    },
  },
  permissions: [],
  outdir: 'dist',
});
