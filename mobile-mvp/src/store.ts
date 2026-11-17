export type Entry = {
  id: string;
  kind: "body" | "precision" | "motion" | "inbody";
  title: string;
  date: string;
  data: any;
  media: Blob[];
};
let promise: Promise<IDBDatabase> | undefined;
function db() {
  return (promise ??= new Promise((resolve, reject) => {
    const r = indexedDB.open("iposture-rebuilt", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("records", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => {
      promise = undefined;
      reject(new Error("기록 저장소를 열지 못했습니다."));
    };
  }));
}
export async function records(): Promise<Entry[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const q = database.transaction("records").objectStore("records").getAll();
    q.onsuccess = () =>
      resolve(
        q.result.sort((a: Entry, b: Entry) => b.date.localeCompare(a.date)),
      );
    q.onerror = () => reject(q.error);
  });
}
async function change(fn: (s: IDBObjectStore) => void) {
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const t = database.transaction("records", "readwrite");
    fn(t.objectStore("records"));
    t.oncomplete = () => resolve();
    t.onabort = () => reject(new Error("저장 공간을 확인해 주세요."));
    t.onerror = () => reject(t.error);
  });
}
export async function save(entry: Omit<Entry, "id" | "date">) {
  const value = {
    ...entry,
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
  };
  await change((s) => s.put(value));
  return value;
}
export async function remove(id: string) {
  await change((s) => s.delete(id));
}
