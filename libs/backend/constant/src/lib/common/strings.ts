export const messageRepresentation = (msg: string): string =>
  msg?.length >= 1024 ? msg.substring(0, 1024) : msg || '';

export const userIdRepresentation = (userId: string): string =>
  userId?.length >= 12 ? userId.substring(userId.length - 12) : userId || '';

export const userRepresentation = (user: { id?: string; name?: string; email?: string }): string => {
  if (user?.name) {
    return user.name;
  }

  if (user?.email) {
    return user.email;
  }

  return user?.id?.substring(user.id.length - 12) || '';
};
