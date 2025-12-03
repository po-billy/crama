// js/menu.js

document.addEventListener("DOMContentLoaded", () => {
    const sections = [
        {
            id: "character-chat",
            title: "캐릭터챗",
            sub: "원하는 캐릭터를 취향대로 고르고 연결해 보세요",
            services: [
                {
                    name: "캐릭터와 대화",
                    desc: "원하는 캐릭터를 취향대로 고르고 연결해 보세요",
                    path: "chat.html",
                    badge: "캐릭터챗",
                    chip: "텍스트 · 다목적",
                    thumb: "./assets/로판.webp"
                },
                {
                    name: "스토리/시나리오",
                    desc: "스토리, 시나리오를 기반으로 캐릭터와 대화해 보세요",
                    path: "",
                    badge: "준비중",
                    chip: "텍스트 · 다목적",
                    thumb: "./assets/모에.webp"
                }
            ]
        },
        {
            id: "studio",
            title: "크라마(crama) 스튜디오",
            sub: "캐릭터를 탄생시켜 보세요!",
            services: [
                {
                    name: "이미지 스튜디오",
                    desc: "프롬프트와 레퍼런스를 조합해서 이미지를 생성하는 메인 스튜디오.",
                    path: "studio.html",
                    badge: "이미지",
                    chip: "생성형 AI",
                    thumb: "./assets/crama-logo1.png"
                }
            ]
        },
        {
            id: "etc",
            title: "워크스페이스 / 기타 도구",
            sub: "작업 효율을 높이는 미니 서비스들",
            services: [
                {
                    name: "유튜브 요약",
                    desc: "링크만 붙여넣으면 영상 내용을 자동으로 요약해주는 도구.",
                    path: "yt-summary.html",
                    badge: "워크스페이스",
                    chip: "영상 요약",
                    thumb: "./assets/crama-logo1.png"
                }
            ]
        }
    ];

    const container = document.getElementById("menuSections");
    if (!container) return;

    container.innerHTML = sections
        .map(sectionToHTML)
        .join("");

    // 카드 클릭 → 해당 path로 이동
    container.addEventListener("click", (e) => {
        const card = e.target.closest(".menu-card");
        if (!card) return;
        const url = card.dataset.path;
        if (url) {
            location.href = url;
        }
    });
});

function sectionToHTML(section) {
    const cardsHTML = section.services.map(serviceToHTML).join("");

    return `
        <article class="menu-section" data-section-id="${section.id}">
            <header class="menu-section-head">
                <div>
                    <div class="menu-section-title">${section.title}</div>
                    ${section.sub
            ? `<div class="menu-section-sub">${section.sub}</div>`
            : ""
        }
                </div>
                ${section.services?.length
            ? `<div class="menu-section-tag">서비스 ${section.services.length}개</div>`
            : ""
        }
            </header>
            <div class="menu-card-row">
                ${cardsHTML}
            </div>
        </article>
    `;
}

function serviceToHTML(service) {
    const thumbHTML = service.thumb
        ? `<div class="menu-card-thumb"><img src="${service.thumb}" alt="${service.name} 미리보기" /></div>`
        : `<div class="menu-card-thumb"></div>`;

    return `
        <div class="menu-card" data-path="${service.path}">
            <div class="menu-card-header">
                <span class="menu-card-badge">${service.badge || "서비스"}</span>
                ${service.chip
            ? `<span class="menu-card-chip">${service.chip}</span>`
            : ""
        }
            </div>
            ${thumbHTML}
            <div class="menu-card-title">${service.name}</div>
            <div class="menu-card-desc">${service.desc}</div>
            <div class="menu-card-footer">
                <span>${service.path}</span>
                <span class="menu-card-link">
                    바로가기
                    <span class="menu-card-link-arrow">→</span>
                </span>
            </div>
        </div>
    `;
}
