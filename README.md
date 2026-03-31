# 대생인재로 - 대전생활과학고등학교 학생 관리 대시보드

## 📁 프로젝트 구조

```
daesaeng-app/
├── server.js           # Node.js 백엔드 (Express)
├── package.json
├── render.yaml         # Render 배포 설정
├── .gitignore
├── public/
│   ├── index.html      # 로그인 페이지
│   └── dashboard.html  # 대시보드 (원본 HTML + 인증/서버연동)
├── data/               # 자동 생성 (users.json, excel_meta.json)
└── uploads/            # 자동 생성 (dashboard.xlsx)
```

---

## 🚀 GitHub + Render 무료 배포 방법

### 1단계: GitHub 저장소 만들기

1. [github.com](https://github.com) 로그인
2. **New repository** 클릭
3. 이름: `daesaeng-injaero` (공개 or 비공개 모두 가능)
4. **Create repository** 클릭

### 2단계: 파일 업로드

```bash
# 터미널에서 이 폴더 안에서 실행
git init
git add .
git commit -m "초기 배포"
git branch -M main
git remote add origin https://github.com/[내아이디]/daesaeng-injaero.git
git push -u origin main
```

또는 GitHub 웹사이트에서 **"Upload files"** 버튼으로 파일 드래그앤드롭도 가능합니다.

### 3단계: Render 배포

1. [render.com](https://render.com) 회원가입 (GitHub 계정으로 로그인)
2. **New +** → **Web Service** 클릭
3. GitHub 저장소 선택: `daesaeng-injaero`
4. 설정:
   - **Name**: daesaeng-injaero
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. **Create Web Service** 클릭
6. 자동 배포 시작 (약 2~3분 소요)
7. 완료 후 `https://daesaeng-injaero.onrender.com` 주소 발급

> ⚠️ **주의**: Render 무료 플랜은 15분 미사용 시 서버가 잠드는데,  
> 처음 접속 시 30초~1분 정도 깨어나는 시간이 필요합니다.  
> 업로드한 파일은 Render의 Disk 기능이 없으면 재시작 시 사라집니다.  
> **Render 무료 플랜에서 파일 영구 보존을 위해**: render.yaml의 disk 설정을 사용하거나,  
> 아래 "영구 저장" 섹션을 참고하세요.

---

## 👤 기본 로그인 계정

| 아이디 | 비밀번호 | 권한 |
|--------|----------|------|
| admin | admin1234 | 관리자 |
| teacher01 | teacher01 | 뷰어 |

> ⚠️ **배포 후 반드시 admin 비밀번호를 변경하세요!**

---

## ⚙️ 관리자 기능

- **엑셀 업로드**: 상단 "관리자 패널" → 엑셀 업로드
  - 원본 `학생관리_프로그램_대시보드.xlsx` 파일을 업로드하면 모든 뷰어에게 반영
- **계정 관리**: 아이디/비밀번호 부여, 계정 삭제

## 👁️ 뷰어 기능

- 학년도 선택
- **종합 현황** 탭: KPI, 차트
- **진로·취업·진학** 탭: 진로 분석 차트
- **산출식·목표치** 탭: 성과지표 산출식 및 2026~2030 목표치

---

## 🔧 Render 영구 파일 저장 설정 (중요!)

Render 무료 플랜에서 업로드한 엑셀 파일이 재시작 후에도 유지되려면:

1. Render 대시보드 → 서비스 선택
2. **Disks** 메뉴 → **Add Disk**
3. Mount Path: `/opt/render/project/src`
4. Size: 1GB
5. 저장

그리고 `server.js`에서 경로를 Render의 persistent 경로로 변경:
```js
// server.js 상단의 경로 설정 변경
const UPLOADS_DIR = process.env.RENDER ? '/opt/render/project/src/uploads' : path.join(__dirname, 'uploads');
const DATA_DIR = process.env.RENDER ? '/opt/render/project/src/data' : path.join(__dirname, 'data');
```

---

## 💻 로컬 실행 (테스트용)

```bash
npm install
npm start
# http://localhost:3000 접속
```
