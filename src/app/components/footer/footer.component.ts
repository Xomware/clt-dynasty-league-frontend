import { Component } from '@angular/core'

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  showDynamicButton = false
  footerButtonText = ''
  githubRepoUrl = 'https://github.com/domgiordano/xomper-front-end'

  openGitHubRepo(): void {
    window.open(this.githubRepoUrl, '_blank')
  }
}
