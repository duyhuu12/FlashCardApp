import type { ImageSourcePropType } from 'react-native';

export interface AvatarOption {
  id: string;
  source: ImageSourcePropType;
}

export const DEFAULT_AVATAR_ID = 'avt1';

export const avatarOptions: AvatarOption[] = [
  { id: 'avt1', source: require('@/assets/images/avatar/avt1.png') },
  { id: 'avt2', source: require('@/assets/images/avatar/avt2.png') },
  { id: 'avt3', source: require('@/assets/images/avatar/avt3.png') },
  { id: 'avt4', source: require('@/assets/images/avatar/avt4.png') },
  { id: 'avt5', source: require('@/assets/images/avatar/avt5.png') },
  { id: 'avt6', source: require('@/assets/images/avatar/avt6.png') },
  { id: 'avt7', source: require('@/assets/images/avatar/avt7.png') },
  { id: 'avt8', source: require('@/assets/images/avatar/avt8.png') },
];

export function getAvatarSource(avatarId?: string | null) {
  return (
    avatarOptions.find((avatar) => avatar.id === avatarId)?.source ??
    avatarOptions[0].source
  );
}
