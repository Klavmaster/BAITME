import type {Metadata} from "next";
import "./globals.css";
export const metadata:Metadata={
  title:"BaitMe | Restorāna panelis",
  description:"Restorānu pārvaldības vide bez BaitMe komisijas"
};
export default function Layout({children}:{children:React.ReactNode}){
 return <html lang="lv"><body>{children}</body></html>;
}
