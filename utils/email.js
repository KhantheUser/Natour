const nodemailer = require('nodemailer');
const pug = require('pug');
const htmlToText  = require('html-to-text');
module.exports = class Email{
    constructor(user,url){
        this.to = user.email;
        this.firstName = user.name.split(' ')[0];
        this.url = url
        this.from = `Duc thien ${process.env.EMAIL_FROM}` 
    }
    newTransport(){
        if(process.env.NODE_ENV === 'production'){
            return nodemailer.createTransport({
                service : 'SendGrid',
                auth :{
                    user : process.env.SENDGRID_USERNAME,
                    password : process.env.SENDGRID_PASSWORD
                }
            })
        }else if (process.env.NODE_ENV === 'development'){
            return nodemailer.createTransport({
                // service : 'SendGrid',
                host : process.env.EMAIL_HOST ,
                auth :{
                    user : process.env.EMAIL_USER,
                    pass : process.env.EMAIL_PASSWORD
                },
                
            })
        }
    }
    //Send actual email
   async send(template,subject){
        //1render HTML base on pug template
        const html = pug.renderFile(`${__dirname}/../view/emails/${template}.pug`,{
            firstName : this.firstName,
            url : this.url,
            subject
        })
        //2)Define email options
        const mailOptions = {
            from : this.from,
            to : this.to,
            subject ,
            html,
            text :htmlToText.fromString(html)
        }
        //3 carete a transport and send it
        
        
        await this.newTransport().sendMail(mailOptions)
    }
    async sendWelcome(){
      await  this.send('welcome','Welcome to natours family')
    }
    async sendPasswordReset(){
        this.send('passwordReset','Your password reset token has been valid for ten minutes')
    }
    
}
