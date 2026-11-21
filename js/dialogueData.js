/* =========================================================================
   1-1. NPC 대화 트리 & 최종 거울 이벤트 선언형 데이터 모듈 (v1.7.0)
   ========================================================================= */

export const NPC_DIALOGUES = {
  park: {
    speaker: "박만식 (경비원)",
    speakerClass: "c-npc",
    greeting: "이 밤중에 무슨 일이십니까? 은하아파트는 곧 철거될 건물입니다. 13층 같은 건 애초에 없어요.",
    choices: [
      {
        label: "1985년 1304호 실종 사건에 대해 묻는다",
        speaker: "박만식 (경비원)",
        speakerClass: "c-npc",
        reply: "1985년 10월 13일 밤이었지... 비명이 들려서 올라갔을 땐 집 안이 텅 비어 있었어. 비상구 앞에서 울고 있던 열다섯 살 소년 하나만 구조됐지.",
        setFlags: ["talkedPark"],
        logOnce: "loggedTalkedPark",
        logText: "경비원 박만식에게 1985년 실종 사건의 초기 증언을 들었다."
      },
      {
        label: "사건 당일 출동했던 경찰 차량에 대해 묻는다",
        speaker: "박만식 (경비원)",
        speakerClass: "c-npc",
        reply: "그날 선임 순경 한 분이 실종되면서 함께 온 지원 순찰차가 지하 주차장 구석에 방치됐었소... 유류품 정리가 덜 된 채 그대로 있을지도 모르지.",
        setFlags: ["askedParkCar"],
        logOnce: "loggedAskedParkCar",
        logText: "박만식으로부터 지하 주차장에 방치된 옛 순찰차 이야기를 들었다."
      },
      {
        label: "[단서 제시] 경비실의 서류 한 장을 내밀며 추궁한다",
        requiredCluesAny: ["blueprint", "guard_log"],
        excludeDeduced: ["combo_coverup"],
        speaker: "박만식 (경비원)",
        speakerClass: "c-npc",
        reply: "서류 한 장 가지고 뭘 어쩌겠다는 거요? 오래된 착오일 뿐이오! 13층 방화문 같은 건 기록에도 없소! ([Tab] 수사 수첩에서 모순되는 두 기록을 먼저 조합해 진실을 도출하자)"
      },
      {
        label: "[진실 2 제시] 준공 도면과 근무일지를 대조한 방화문 봉쇄 진실을 추궁한다",
        requiredDeduced: ["combo_coverup"],
        speaker: "박만식 (경비원)",
        speakerClass: "c-npc",
        reply: "...두 기록을 맞췄군. 맞아, 그날 밤 1304호 아버지가 망상에 미쳐 가족을 가뒀어. 난 겁이 나서 방화문을 잠그고 신고를 늦췄지. 하지만 그날 밤 현장에 있던 소년이 누구였는지는 말할 수 없소...",
        setFlags: ["parkStage2"],
        unlockDoor1304: true,
        logOnce: "loggedParkStage2",
        logText: "박만식이 1985년 방화문 시건과 출입 기록 파기를 일부 인정했다."
      },
      {
        label: "[진실 5 제시] 복원된 강 순경 아들의 기억과 방문자 명부의 진실을 내민다",
        requiredFlags: ["parkStage2"],
        excludeFlags: ["parkConfessed"],
        requiredDeduced: ["combo_past"],
        onceFlag: "parkConfessed",
        sanityDelta: 10,
        sanityReason: "박만식의 완전한 참회와 증언",
        logText: "박만식이 강현우와 그의 아버지(강 순경)에 대한 모든 진실을 자백했다.",
        speaker: "박만식 (경비원)",
        speakerClass: "c-npc",
        reply: "자네 얼굴을 보니 이제야 알겠구먼... 그날 밤 강 순경님이 윤서를 구하려 13층에 올라갔다가 실종됐고, 아드님만 홀로 살아남았소. 부디 13층의 비극을 끝내주게!"
      },
      {
        label: "대화를 마친다",
        speaker: "강현우",
        speakerClass: "c-hero",
        reply: "알겠습니다. 경비실과 아파트 내부를 좀 더 살펴보겠습니다."
      }
    ]
  },

  han: {
    speaker: "한미정 (주민)",
    speakerClass: "c-npc",
    greeting: "형사님이신가요...? 제발 저 좀 살려주세요. 12층 위에는 아무것도 없어야 하는데, 누군가 계속 문을 두드려요.",
    choices: [
      {
        label: "밤마다 위층에서 들린다는 발소리에 대해 묻는다",
        speaker: "한미정 (주민)",
        speakerClass: "c-npc",
        reply: "저는 1204호에 살아요. 매일 밤 11시 47분만 되면 천장 위... 13층에서 여자아이 울음소리와 노크 소리가 들려요. 그 직전엔 꼭 복도 형광등이 깜빡거리더라고요.",
        setFlags: ["talkedHan"],
        logOnce: "loggedTalkedHan",
        logText: "주민 한미정에게 매일 밤 11시 47분마다 들리는 울음소리를 들었다."
      },
      {
        label: "[진실 4 제시] '윤서'의 진실에 대해 알고 있는지 묻는다",
        excludeFlags: ["hanTruth"],
        requiredDeduced: ["combo_yoonseo"],
        onceFlag: "hanTruth",
        sanityDelta: 6,
        sanityReason: "한미정의 진심 어린 증언",
        logText: "한미정이 윤서의 옛 피아노 선생이었음을 밝히고 진실을 증언했다.",
        speaker: "한미정 (주민)",
        speakerClass: "c-npc",
        reply: "윤서의 진실을 알아내셨군요... 저는 13년 전 윤서의 피아노 선생님이었어요. 윤서는 착하고 여린 아이였어요. 그날 밤 윤서를 구하러 갔던 한 소년도 있었는데..."
      },
      {
        label: "대화를 마친다",
        speaker: "강현우",
        speakerClass: "c-hero",
        reply: "걱정하지 마세요. 제가 반드시 원인을 밝혀내겠습니다."
      }
    ]
  },

  yoonseo: {
    speaker: "윤서",
    speakerClass: "c-npc",
    greeting: "......똑, 똑, 똑. 열두 번까지는 참았는데, 열세 번째 노크가 시작됐어요.",
    choices: [
      {
        label: "\"너는 누구니? 왜 이 어두운 복도에 혼자 서 있니?\"",
        speaker: "윤서",
        speakerClass: "c-npc",
        reply: "...아저씨도 13번째 방문자인가요? 1304호 문은 안쪽에서 단단히 잠겨 있어요. 존재하지 않는 13층이 왜 생겨났는지, 누가 밖에서 방화문을 잠갔는지 그 진실을 깨닫기 전엔 열리지 않을 거예요... 그리고 형광등이 깜빡이면 꼭 숨어야 해요. 망가진 아빠가 오고 있다는 신호니까요.",
        setFlags: ["metYoonseo"],
        logOnce: "loggedMetYoonseo",
        logText: "13층 복도의 소녀 윤서로부터 1304호 봉인 조건에 대한 단서를 들었다."
      },
      {
        label: "\"윤서야, 이제 무서워하지 마. 네가 악령이 아니라는 진실을 모두 알아냈어.\"",
        requiredDeduced: ["combo_yoonseo"],
        excludeFlags: ["savedYoonseo"],
        onceFlag: "savedYoonseo",
        unlockDoor1304: true,
        calmGhost: true,
        sanityDelta: 15,
        sanityReason: "윤서의 원한 완화",
        logText: "윤서에게 진실을 전하여 그녀의 두려움을 진정시켰다.",
        speaker: "윤서",
        speakerClass: "c-npc",
        reply: "...정말 제 진실을 알아봐 주신 거예요?{{PAST_MEMORY}} 13년 동안 아무도 제 목소리를 들어주지 않았어요. 숨겨진 방의 거울을 봐주세요... 모든 진실이 거기 있어요.",
        tokens: {
          PAST_MEMORY: {
            requiredDeduced: ["combo_past"],
            text: " 그날 밤 너를 구하러 왔던 소년도 바로 나였어.",
            fallback: ""
          }
        }
      },
      {
        label: "\"원혼이라면 당장 사라져라!\" (적대적으로 경고한다)",
        excludeDeduced: ["combo_yoonseo"],
        excludeFlags: ["provokedYoonseo"],
        onceFlag: "provokedYoonseo",
        sanityDelta: -18,
        sanityReason: "13번째 방문자의 분노 촉발",
        ghostEventId: "hall_ghost",
        ghostWarningOverride: "윤서가 겁에 질려 물러서자 복도 끝에서 무거운 발소리와 함께 형광등이 격렬하게 깜빡이기 시작한다! 은신처를 찾거나 구역을 벗어나라 [H]!",
        ghostChaseOverride: "형광등이 산산조각 나며 정전되었다! 광기에 잠식된 13번째 방문자가 비명을 지르며 달려온다!"
      },
      {
        label: "조용히 물러난다",
        speaker: "강현우",
        speakerClass: "c-hero",
        reply: "잠시만 기다려, 윤서야. 내가 1304호의 기록을 확인하고 돌아올게."
      }
    ]
  }
};
