import Manialink from "@core/ui/manialink";

export default class IntroWindow extends Manialink {
    private currentPage: number;

    constructor(login: string, totalPages: number) {
        super(login);   
        
        this.currentPage = 0;
        this.data['page'] = 0;
        this.data['totalPages'] = totalPages;
    }

    setPage(page: number) {
        this.currentPage = page;
        this.data['page'] = page;
    }

    getPage(): number {
        return this.currentPage;
    }
}