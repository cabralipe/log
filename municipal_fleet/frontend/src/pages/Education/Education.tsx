import { ClassesPage } from "./Classes";
import { StudentsPage } from "./Students";
import { SchoolsPage } from "./Schools";
import "../../styles/EducationPage.css";

export const EducationPage = () => {
  return (
    <div className="education-page">
      <SchoolsPage />
      <div className="education-columns">
        <ClassesPage />
        <StudentsPage />
      </div>
    </div>
  );
};
