import type {Metadata} from "next";
import "./globals.css";
export const metadata:Metadata={
  title:"BaitMe Business | Restorānu pārvaldība",
  description:"BaitMe Business — restorānu, ēdienkartes, piegādes zonu un pasūtījumu pārvaldība"
};
export default function Layout({children}:{children:React.ReactNode}){
 return <html lang="lv"><body>{children}</body></html>;
}
