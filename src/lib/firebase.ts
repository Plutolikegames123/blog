import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, getDoc, collection, addDoc, deleteDoc, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

export interface Profile {
  name: string;
  email: string;
  bio: string;
  profilePic: string;
  coverPhoto: string;
  socials: {
    facebook: string;
    twitter: string;
    instagram: string;
    linkedin: string;
    youtube: string;
  };
}

export interface InfoSection {
  id: string;
  label: string;
  value: string;
}

export interface ContentBlock {
  id: string;
  type: 'text' | 'image' | 'video';
  value: string;
}

export interface BlogSettings {
  typewriterWords: string[];
  fontSize: number;
  textColor: string;
  bgColor: string;
}

export interface ImpactBlock {
  id: string;
  type: 'positive' | 'negative';
  label: string;
  value: string;
  mediaType?: 'none' | 'image' | 'video';
  mediaUrl?: string;
}

export interface BlogData {
  id?: string;
  name: string;
  password?: string;
  impactTitle?: string;
  isActive: boolean;
  profile: Profile;
  infoSections: InfoSection[];
  contentBlocks: ContentBlock[];
  socialImpact: ImpactBlock[];
  settings: BlogSettings;
  updatedAt?: any;
}

export const INITIAL_DATA: BlogData = {
  name: "My Vibrant Blog",
  password: "GROWINGOLD9886",
  impactTitle: "Social Media Impact",
  isActive: true,
  profile: {
    name: 'Enrico F. Tubal',
    email: 'enricotubal2005@gmail.com',
    bio: "If you're in the verge of giving up, think about why you started.",
    profilePic: 'https://picsum.photos/seed/enrico/200/200',
    coverPhoto: 'https://picsum.photos/seed/cover/1200/400',
    socials: {
      facebook: '',
      twitter: '',
      instagram: '',
      linkedin: '',
      youtube: '',
    }
  },
  infoSections: [
    { id: 'intro', label: 'Introduction', value: "Hello, my name is Enrico F. Tubal. I am an individual who believes that no matter what happens, you shouldn't give up; you must fight and achieve the goals and dreams that you want in order to prove to yourself that you can do it." },
    { id: 'industry', label: 'Industry', value: 'Education' },
    { id: 'location', label: 'Location', value: 'Cabaulay, Zamboanga City' },
    { id: 'occ', label: 'Occupation', value: 'Student' }
  ],
  contentBlocks: [
    { id: '1', type: 'text', value: 'This is my first official blog post check-in!' }
  ],
  socialImpact: [
    { id: 'p1', type: 'positive', label: 'Positive', value: 'Connectivity, information access, and democracy of voice.' },
    { id: 'n1', type: 'negative', label: 'Negative', value: 'Self-image issues, misinformation, and digital addiction.' }
  ],
  settings: {
    typewriterWords: ["CREATIVE SPIRIT!", "MILKSHAKE LOVER!", "TECH EXPLORER!", "DREAM BIG!"],
    fontSize: 18,
    textColor: '#1A1A1A',
    bgColor: '#FFF5F7'
  }
};

export const saveBlog = async (id: string, data: BlogData) => {
  await setDoc(doc(db, 'blogs', id), {
    ...data,
    updatedAt: serverTimestamp()
  });
};

export const duplicateBlog = async (data: BlogData) => {
  const newData = { ...data, name: `${data.name}(copy)`, updatedAt: serverTimestamp() };
  delete newData.id;
  const docRef = await addDoc(collection(db, 'blogs'), newData);
  return docRef.id;
};

export const deleteBlog = async (id: string) => {
  await deleteDoc(doc(db, 'blogs', id));
};

export const renameBlog = async (id: string, newName: string) => {
  await setDoc(doc(db, 'blogs', id), { name: newName, updatedAt: serverTimestamp() }, { merge: true });
};

export const toggleBlogStatus = async (id: string, currentStatus: boolean) => {
  await setDoc(doc(db, 'blogs', id), { isActive: !currentStatus, updatedAt: serverTimestamp() }, { merge: true });
};

export const createNewBlog = async (name: string = "New Site") => {
  const newData = { ...INITIAL_DATA, name, updatedAt: serverTimestamp() };
  const docRef = await addDoc(collection(db, 'blogs'), newData);
  return docRef.id;
};

export const blogsQuery = query(collection(db, 'blogs'), orderBy('updatedAt', 'desc'));
