import type { EquipmentId, GrowthZone } from '../growth.ts';

export interface EquipmentDefinition {
  id: EquipmentId;
  name: string;
  verseRef: string;
  description: string;
  emoji: string;
  tierNames: string[];
}

export const ARMOR_CATALOG: Record<EquipmentId, EquipmentDefinition> = {
  belt_truth: {
    id: 'belt_truth',
    name: '진리의 허리띠',
    verseRef: '에베소서 6:14',
    description: '거짓과 진실을 분별하는 힘을 길러요.',
    emoji: '🪢',
    tierNames: ['없음', '천 허리띠', '가죽 허리띠', '빛나는 진리띠', '별빛 진리띠', '말씀의 진리띠'],
  },
  breastplate_righteousness: {
    id: 'breastplate_righteousness',
    name: '의의 흉배',
    verseRef: '에베소서 6:14',
    description: '바른 선택을 지키는 든든한 마음 갑옷이에요.',
    emoji: '🦺',
    tierNames: ['없음', '가죽 흉배', '은빛 흉배', '황금 흉배', '별빛 흉배', '의의 빛 갑옷'],
  },
  shoes_peace: {
    id: 'shoes_peace',
    name: '평안의 복음의 신',
    verseRef: '에베소서 6:15',
    description: '좋은 소식을 전하러 씩씩하게 걸어가요.',
    emoji: '🥾',
    tierNames: ['없음', '여행 샌들', '튼튼한 샌들', '평안의 장화', '빛길 신발', '복음의 날개신'],
  },
  shield_faith: {
    id: 'shield_faith',
    name: '믿음의 방패',
    verseRef: '에베소서 6:16',
    description: '두려움과 거짓의 불화살을 믿음으로 막아요.',
    emoji: '🛡️',
    tierNames: ['없음', '나무 방패', '청동 방패', '황금 방패', '별빛 방패', '빛의 믿음 방패'],
  },
  helmet_salvation: {
    id: 'helmet_salvation',
    name: '구원의 투구',
    verseRef: '에베소서 6:17',
    description: '하나님 안에서 소망을 기억하도록 도와줘요.',
    emoji: '⛑️',
    tierNames: ['없음', '가죽 투구', '은빛 투구', '황금 투구', '소망의 투구', '구원의 빛 투구'],
  },
  sword_spirit: {
    id: 'sword_spirit',
    name: '성령의 검',
    verseRef: '에베소서 6:17',
    description: '배우고 암송한 말씀을 상황에 맞게 선포해요.',
    emoji: '⚔️',
    tierNames: ['없음', '나무 말씀검', '은빛 말씀검', '황금 말씀검', '불꽃 말씀검', '성령의 빛 검'],
  },
  crown: {
    id: 'crown',
    name: '생명의 면류관',
    verseRef: '야고보서 1:12',
    description: '오래 믿음으로 걸어온 여정을 기념하는 상징이에요.',
    emoji: '👑',
    tierNames: ['없음', '새싹 화관', '은빛 관', '황금 관', '별빛 관', '생명의 면류관'],
  },
};

export const ZONE_INFO: Record<GrowthZone, { name: string; emoji: string; description: string }> = {
  home: { name: '말씀의 집', emoji: '🏡', description: '먹고, 쉬고, 읽고, 기도하며 준비해요.' },
  road: { name: '평안의 길', emoji: '🌿', description: '밖으로 나가 사람들을 격려하고 사랑을 실천해요.' },
  wilderness: { name: '광야', emoji: '🏜️', description: '두려움과 유혹을 말씀으로 이겨내는 훈련장이에요.' },
  village: { name: '회복의 마을', emoji: '🏘️', description: '상처받은 이웃을 위로하고 소망을 전해요.' },
};

export interface ServiceMission {
  id: string;
  title: string;
  zone: GrowthZone;
  emoji: string;
}

export const SERVICE_MISSIONS: ServiceMission[] = [
  { id: 'help-home', title: '집에서 가족을 먼저 도와주기', zone: 'home', emoji: '🧺' },
  { id: 'encourage-lonely', title: '혼자 있는 친구에게 따뜻한 말 건네기', zone: 'road', emoji: '💛' },
  { id: 'share-hope', title: '낙심한 이웃에게 소망의 말씀 전하기', zone: 'road', emoji: '✨' },
  { id: 'pray-neighbor', title: '힘든 이웃을 위해 함께 기도하기', zone: 'village', emoji: '🙏' },
];

export function getServiceMission(id: string): ServiceMission | undefined {
  return SERVICE_MISSIONS.find((mission) => mission.id === id);
}
