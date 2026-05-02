export async function openDeckInBrowser(
  presentationUrl: string | undefined,
  openExternal: (url: string) => Promise<boolean>,
): Promise<boolean> {
  if (!presentationUrl) {
    return false;
  }
  return await openExternal(presentationUrl);
}
